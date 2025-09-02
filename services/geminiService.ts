import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

if (!API_KEY) {
  throw new Error('Gemini API key is not defined. Please check your .env file.');
}

const genAI = new GoogleGenerativeAI(API_KEY);

const createPrompt = (transactions: any[]): string => {
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

  return `
    You are a friendly and helpful financial assistant for a budget tracking app.
    Analyze the following list of recent transactions and provide a brief, insightful summary for the user.
    Focus on spending habits, potential savings, and any notable patterns.
    Keep the analysis concise, friendly, and easy to understand, using bullet points.
    The user's transactions are:
    ${transactionsString}
  `;
};

export const analyzeTransactionsWithGemini = async (transactions: any[]): Promise<string> => {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = createPrompt(transactions);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error analyzing transactions with Gemini:', error);
    return 'Sorry, I could not analyze the transactions at this moment. Please try again later.';
  }
};