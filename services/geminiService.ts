import { GoogleGenerativeAI } from '@google/generative-ai';
import { getCategoryLabel, isSavingsCategory } from '@/constants/Categories';
import { getExchangeRates, ExchangeRates } from '@/services/currencyService';

const createPrompt = (transactions: any[], lang: 'tr' | 'en' = 'tr'): string => {
  const transactionsString = JSON.stringify(
    transactions.map((t) => ({
      type: t.type,
      amount: t.amount,
      category: t.category,
      description: t.description,
      currency: t.currency,
    })),
    null,
    2
  );

  const langInstruction =
    lang === 'tr'
      ? 'Please write your entire analysis and summary strictly in Turkish.'
      : 'Please write your entire analysis and summary strictly in English.';

  return `
    You are a friendly and helpful financial assistant for a budget tracking app.
    Analyze the following list of recent transactions and provide a brief, insightful summary for the user.
    Focus on spending habits, potential savings, and any notable patterns.
    Keep the analysis concise, friendly, and easy to understand, using bullet points.
    ${langInstruction}
    The user's transactions are:
    ${transactionsString}
  `;
};

const ESSENTIAL_CATEGORIES = new Set([
  'housing',
  'bills',
  'groceries',
  'health',
  'education',
  'debt',
  'transport',
]);

const formatMoneyTRY = (val: number, lang: 'tr' | 'en'): string => {
  return `₺${Math.abs(val).toLocaleString(lang === 'tr' ? 'tr-TR' : 'en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

/**
 * On-Device Smart Financial Analysis Engine
 * Runs 100% locally with zero API cost, zero key exposure, and full multi-currency support.
 */
const generateOnDeviceAnalysis = async (
  transactions: any[],
  lang: 'tr' | 'en' = 'tr'
): Promise<string> => {
  if (!transactions || transactions.length === 0) {
    return lang === 'tr'
      ? 'Henüz analiz edilecek bir işlem bulunmuyor. Gelir veya gider ekledikten sonra detaylı finansal analizinizi burada görebilirsiniz.'
      : 'No transactions found to analyze yet. Add your income or expenses to see your personalized financial insights here.';
  }

  let rates: ExchangeRates = { TRY: 1, USD: 34.5, EUR: 37.5, GBP: 44.0 };
  try {
    const liveRates = await getExchangeRates();
    if (liveRates && Object.keys(liveRates).length > 1) {
      rates = { ...rates, ...liveRates };
    }
  } catch {}

  let totalIncomeTRY = 0;
  let totalExpenseTRY = 0;
  let totalInvestmentTRY = 0;
  let essentialExpenseTRY = 0;
  let discretionaryExpenseTRY = 0;

  const expenseByCategory: Record<string, { amountTRY: number; count: number; rawKey: string }> = {};
  let largestExpense: { title: string; categoryLabel: string; amountTRY: number } | null = null;

  for (const tx of transactions) {
    const rate = rates[tx.currency || 'TRY'] || 1;
    const absAmountTRY = Math.abs(Number(tx.amount) || 0) * rate;
    if (absAmountTRY <= 0) continue;

    const isIncome = tx.type === 'income' || Number(tx.amount) > 0;
    const isInvestment = isSavingsCategory(tx.category);

    if (isInvestment) {
      totalInvestmentTRY += absAmountTRY;
      continue;
    }

    if (isIncome) {
      totalIncomeTRY += absAmountTRY;
    } else {
      totalExpenseTRY += absAmountTRY;
      const rawCat = (tx.category || 'other').toLowerCase().trim();
      const catLabel = getCategoryLabel(tx.category || 'Other', lang);

      if (!expenseByCategory[catLabel]) {
        expenseByCategory[catLabel] = { amountTRY: 0, count: 0, rawKey: rawCat };
      }
      expenseByCategory[catLabel].amountTRY += absAmountTRY;
      expenseByCategory[catLabel].count += 1;

      const isEssential =
        ESSENTIAL_CATEGORIES.has(rawCat) ||
        rawCat.includes('kira') ||
        rawCat.includes('fatura') ||
        rawCat.includes('market') ||
        rawCat.includes('borç') ||
        rawCat.includes('taksit') ||
        rawCat.includes('ulaşım') ||
        rawCat.includes('sağlık');

      if (isEssential) {
        essentialExpenseTRY += absAmountTRY;
      } else {
        discretionaryExpenseTRY += absAmountTRY;
      }

      if (!largestExpense || absAmountTRY > largestExpense.amountTRY) {
        largestExpense = {
          title: tx.description || catLabel,
          categoryLabel: catLabel,
          amountTRY: absAmountTRY,
        };
      }
    }
  }

  const sortedCategories = Object.entries(expenseByCategory)
    .map(([label, info]) => ({
      label,
      amountTRY: info.amountTRY,
      count: info.count,
      rawKey: info.rawKey,
      pct: totalExpenseTRY > 0 ? (info.amountTRY / totalExpenseTRY) * 100 : 0,
    }))
    .sort((a, b) => b.amountTRY - a.amountTRY);

  const netCashFlowTRY = totalIncomeTRY - totalExpenseTRY;
  const savingsRatePct =
    totalIncomeTRY > 0 ? ((totalIncomeTRY - totalExpenseTRY) / totalIncomeTRY) * 100 : null;

  const bullets: string[] = [];

  // 1. Cash Flow & Savings Rate Insight
  if (totalIncomeTRY > 0 && totalExpenseTRY > 0) {
    if (netCashFlowTRY >= 0) {
      const rateStr = savingsRatePct !== null ? `%${savingsRatePct.toFixed(1)}` : '';
      if (lang === 'tr') {
        bullets.push(
          `📊 **Nakit Akışı & Tasarruf:** Toplam ${formatMoneyTRY(totalIncomeTRY, 'tr')} gelirinize karşılık ${formatMoneyTRY(totalExpenseTRY, 'tr')} harcama yaptınız. Gelirinizin **${rateStr}** kadarını (${formatMoneyTRY(netCashFlowTRY, 'tr')}) korumayı başardınız.${
            savingsRatePct! >= 20
              ? ' İdeal %20 tasarruf hedefinin üzerindesiniz, harika bir finansal disiplin!'
              : ' Tasarruf oranınızı ideal %20 bandına taşımak için esnek giderleri biraz kısabilirsiniz.'
          }`
        );
      } else {
        bullets.push(
          `📊 **Cash Flow & Savings:** Against a total income of ${formatMoneyTRY(totalIncomeTRY, 'en')}, you spent ${formatMoneyTRY(totalExpenseTRY, 'en')}, retaining **${rateStr}** (${formatMoneyTRY(netCashFlowTRY, 'en')}) of your income.${
            savingsRatePct! >= 20
              ? ' You are above the ideal 20% savings benchmark—great discipline!'
              : ' Trimming discretionary expenses slightly can help you reach the ideal 20% savings target.'
          }`
        );
      }
    } else {
      if (lang === 'tr') {
        bullets.push(
          `⚠️ **Nakit Akışı Uyarısı:** Toplam giderleriniz (${formatMoneyTRY(totalExpenseTRY, 'tr')}), kayıtlı gelirinizden (${formatMoneyTRY(totalIncomeTRY, 'tr')}) **${formatMoneyTRY(Math.abs(netCashFlowTRY), 'tr')} daha fazla**. Bütçe açığını dengelemek için sabit olmayan harcamaları gözden geçirmeniz önerilir.`
        );
      } else {
        bullets.push(
          `⚠️ **Cash Flow Alert:** Your total expenses (${formatMoneyTRY(totalExpenseTRY, 'en')}) exceed your recorded income (${formatMoneyTRY(totalIncomeTRY, 'en')}) by **${formatMoneyTRY(Math.abs(netCashFlowTRY), 'en')}**. Consider reviewing non-essential spending to balance your budget.`
        );
      }
    }
  } else if (totalExpenseTRY > 0) {
    if (lang === 'tr') {
      bullets.push(
        `📊 **Genel Harcama Özeti:** Toplam **${formatMoneyTRY(totalExpenseTRY, 'tr')}** tutarında gider kaydınız bulunuyor. Gelir işlemlerinizi de ekleyerek net tasarruf oranınızı takip edebilirsiniz.`
      );
    } else {
      bullets.push(
        `📊 **Spending Overview:** You have recorded **${formatMoneyTRY(totalExpenseTRY, 'en')}** in total expenses. Add your income records as well to track your net savings rate.`
      );
    }
  } else if (totalIncomeTRY > 0) {
    if (lang === 'tr') {
      bullets.push(
        `📊 **Gelir Özeti:** Toplam **${formatMoneyTRY(totalIncomeTRY, 'tr')}** gelir kaydınız bulunuyor, henüz harcama kaydı girilmemiş.`
      );
    } else {
      bullets.push(
        `📊 **Income Overview:** You have **${formatMoneyTRY(totalIncomeTRY, 'en')}** in recorded income with no expenses logged yet.`
      );
    }
  }

  // 2. Top Spending Categories Insight
  if (sortedCategories.length > 0) {
    const top1 = sortedCategories[0];
    const top2 = sortedCategories[1];
    if (lang === 'tr') {
      const secondPart = top2
        ? `, ikinci sırada ise **%${top2.pct.toFixed(1)}** ile **${top2.label}** (${formatMoneyTRY(top2.amountTRY, 'tr')}) yer alıyor.`
        : ' olarak öne çıkıyor.';
      bullets.push(
        `🔍 **Harcama Dağılımı:** En büyük gider kaleminiz toplam harcamanızın **%${top1.pct.toFixed(1)}**'ini oluşturan **${top1.label}** (${formatMoneyTRY(top1.amountTRY, 'tr')})${secondPart}`
      );
    } else {
      const secondPart = top2
        ? `, followed by **${top2.label}** at **${top2.pct.toFixed(1)}%** (${formatMoneyTRY(top2.amountTRY, 'en')}).`
        : '.';
      bullets.push(
        `🔍 **Spending Breakdown:** Your top expense category is **${top1.label}**, accounting for **${top1.pct.toFixed(1)}%** (${formatMoneyTRY(top1.amountTRY, 'en')}) of total spending${secondPart}`
      );
    }
  }

  // 3. Essential vs. Discretionary (50/30/20 Rule)
  if (totalExpenseTRY > 0 && discretionaryExpenseTRY > 0) {
    const discPct = (discretionaryExpenseTRY / totalExpenseTRY) * 100;
    const essPct = (essentialExpenseTRY / totalExpenseTRY) * 100;
    if (lang === 'tr') {
      bullets.push(
        `⚖️ **Zorunlu vs. Esnek Giderler:** Harcamalarınızın **%${essPct.toFixed(0)}**'i temel/zorunlu ihtiyaçlardan, **%${discPct.toFixed(0)}**'i (${formatMoneyTRY(discretionaryExpenseTRY, 'tr')}) ise esnek/keyfi harcamalardan oluşuyor.`
      );
    } else {
      bullets.push(
        `⚖️ **Essential vs. Discretionary:** **${essPct.toFixed(0)}%** of your spending goes to essentials, while **${discPct.toFixed(0)}%** (${formatMoneyTRY(discretionaryExpenseTRY, 'en')}) is discretionary spending.`
      );
    }
  }

  // 4. Notable Single Transaction / Anomaly
  if (largestExpense && sortedCategories.length > 0 && transactions.length >= 3) {
    const avgExpense = totalExpenseTRY / Math.max(1, transactions.filter((t) => t.type !== 'income' && Number(t.amount) < 0).length);
    if (largestExpense.amountTRY > avgExpense * 1.4) {
      if (lang === 'tr') {
        bullets.push(
          `📌 **En Yüksek Tekil Harcama:** **${largestExpense.title}** (${largestExpense.categoryLabel}) için yapılan **${formatMoneyTRY(largestExpense.amountTRY, 'tr')}** tutarındaki ödeme, dönem içindeki en büyük tekil gideriniz.`
        );
      } else {
        bullets.push(
          `📌 **Largest Single Expense:** **${largestExpense.title}** (${largestExpense.categoryLabel}) at **${formatMoneyTRY(largestExpense.amountTRY, 'en')}** stands out as your largest single expense.`
        );
      }
    }
  }

  // 5. Investments Summary (if any)
  if (totalInvestmentTRY > 0) {
    if (lang === 'tr') {
      bullets.push(
        `💎 **Birikim & Yatırım:** Bu dönemde cüzdan harcamalarınızın dışında toplam **${formatMoneyTRY(totalInvestmentTRY, 'tr')}** tutarında varlık/yatırım işlemi gerçekleştirdiniz.`
      );
    } else {
      bullets.push(
        `💎 **Savings & Investments:** Beyond regular expenses, you allocated **${formatMoneyTRY(totalInvestmentTRY, 'en')}** toward investments and savings.`
      );
    }
  }

  // 6. Concrete Actionable Savings Recommendation
  if (sortedCategories.length > 0) {
    const targetCat = sortedCategories[0];
    const monthlySave = targetCat.amountTRY * 0.15;
    const yearlySave = monthlySave * 12;
    if (lang === 'tr') {
      bullets.push(
        `💡 **Tasarruf Fırsatı:** En yoğun harcama yaptığınız **${targetCat.label}** kategorisinde uygulayacağınız **%15**'lik küçük bir optimizasyon, size ayda **${formatMoneyTRY(monthlySave, 'tr')}** (yılda **${formatMoneyTRY(yearlySave, 'tr')}**) ek birikim kazandırabilir.`
      );
    } else {
      bullets.push(
        `💡 **Savings Opportunity:** A modest **15%** reduction in your top category (**${targetCat.label}**) would free up **${formatMoneyTRY(monthlySave, 'en')}** per month (**${formatMoneyTRY(yearlySave, 'en')}** per year) for your investments.`
      );
    }
  }

  return bullets.join('\n\n');
};

/**
 * Attempts Browser Built-in AI (Chrome Gemini Nano) -> Cloud Gemini API (if key configured) -> On-Device Smart Financial Engine
 */
export const analyzeTransactionsWithGemini = async (
  transactions: any[],
  lang: 'tr' | 'en' = 'tr'
): Promise<string> => {
  // 1. Try Browser Built-in AI (Chrome Gemini Nano) if available on Web
  try {
    const globalAny = globalThis as any;
    const languageModelFactory =
      globalAny?.LanguageModel || globalAny?.ai?.languageModel;
    if (languageModelFactory && typeof languageModelFactory.create === 'function') {
      const session = await languageModelFactory.create();
      if (session && typeof session.prompt === 'function') {
        const prompt = createPrompt(transactions, lang);
        const result = await session.prompt(prompt);
        if (result && typeof result === 'string' && result.trim().length > 20) {
          return result.trim();
        }
      }
    }
  } catch {
    // Browser built-in AI not available, continue to next layer
  }

  // 2. Try Cloud Gemini API if user explicitly configured an API key in .env
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (apiKey && apiKey.trim().length > 10 && !apiKey.includes('placeholder')) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const prompt = createPrompt(transactions, lang);
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      if (text && text.trim().length > 0) {
        return text;
      }
    } catch (error) {
      console.warn('Cloud Gemini API unavailable, falling back to on-device analysis:', error);
    }
  }

  // 3. Default: Run On-Device Smart Financial Analysis Engine (100% Free & Offline-Capable)
  await new Promise((resolve) => setTimeout(resolve, 450));
  return generateOnDeviceAnalysis(transactions, lang);
};
