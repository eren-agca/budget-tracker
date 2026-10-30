import { GoogleGenerativeAI } from '@google/generative-ai';

const createPrompt = (transactions: any[], lang: 'tr' | 'en' = 'tr'): string => {
  const transactionsString = JSON.stringify(
    transactions.map((t) => ({
      type: t.type,
      amount: t.amount,
      category: t.category,
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

export const analyzeTransactionsWithGemini = async (
  transactions: any[],
  lang: 'tr' | 'en' = 'tr'
): Promise<string> => {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    console.warn('Gemini API key is not defined. Please check your .env file.');
    return lang === 'tr'
      ? 'Gemini API anahtarı tanımlanmamış. Lütfen .env dosyanızda EXPO_PUBLIC_GEMINI_API_KEY değerini tanımlayın.'
      : 'Gemini API key is not defined. Please set EXPO_PUBLIC_GEMINI_API_KEY in your .env file.';
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = createPrompt(transactions, lang);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error analyzing transactions with Gemini:', error);
    return lang === 'tr'
      ? 'Üzgünüm, şu anda işlemleriniz analiz edilemedi. Lütfen daha sonra tekrar deneyin.'
      : 'Sorry, I could not analyze the transactions at this moment. Please try again later.';
  }
};