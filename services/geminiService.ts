

import { GoogleGenAI } from "@google/genai";
import { AppState } from "../types";

const resolveApiKey = (): string | undefined => {
  // Vite chỉ expose các biến bắt đầu bằng VITE_, nhưng vẫn kiểm tra thêm
  // các tên phổ biến khác để tương thích với cấu hình hiện có.
  return (
    // Biến môi trường chuẩn cho Vite
    (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_GEMINI_API_KEY ??
    // Một số cấu hình cũ lưu dưới dạng GEMINI_API_KEY
    (import.meta as { env?: Record<string, string | undefined> }).env?.GEMINI_API_KEY ??
    // Dự phòng cho môi trường Node (ví dụ khi chạy bằng SSR/tooling)
    process.env.GEMINI_API_KEY
  );
};

// Helper to get AI instance safely
const getAIClient = () => {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    console.warn("Gemini API key is missing. Set VITE_GEMINI_API_KEY in your .env file.");
    return null;
  }
  return new GoogleGenAI({ apiKey });
};

export const chatWithInventoryAI = async (
  userMessage: string,
  appState: AppState
): Promise<string> => {
  try {
    const ai = getAIClient();
    if (!ai) {
      return "Không tìm thấy API key Gemini. Vui lòng cấu hình biến VITE_GEMINI_API_KEY trước khi sử dụng trợ lý.";
    }

    // Prepare context from app state
    const inventoryContext = JSON.stringify(appState.inventory.map(i => ({
      name: i.name,
      total: i.totalQuantity,
      available: i.availableQuantity,
      inUse: i.inUseQuantity,
      maintenance: i.maintenanceQuantity,
      location: i.location
    })));

    const eventContext = JSON.stringify(appState.events.filter(e => e.status !== 'COMPLETED' && e.status !== 'CANCELLED').map(e => ({
      name: e.name,
      location: e.location,
      status: e.status,
      items: e.items.map(i => {
        const itemDetails = appState.inventory.find(inv => inv.id === i.itemId);
        return `${itemDetails?.name} (Qty: ${i.quantity})`;
      })
    })));

    const systemPrompt = `
      Bạn là trợ lý ảo thông minh cho phần mềm quản lý kho sự kiện (EventStock AI).

      Dữ liệu kho hàng hiện tại (JSON): ${inventoryContext}
      Dữ liệu sự kiện đang diễn ra/sắp tới (JSON): ${eventContext}

      Nhiệm vụ của bạn:
      1. Trả lời các câu hỏi về số lượng hàng hóa, vị trí hàng hóa.
      2. Cho biết hàng hóa đang được sử dụng ở sự kiện nào.
      3. Cảnh báo nếu người dùng hỏi mượn thiết bị mà số lượng tồn kho không đủ.
      4. Sử dụng ngôn ngữ tiếng Việt tự nhiên, chuyên nghiệp.
      5. Nếu được hỏi về một thiết bị không có trong danh sách, hãy nói rõ là kho không có.

      Hãy trả lời ngắn gọn, súc tích.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: { parts: [{ text: userMessage }] },
      config: {
        systemInstruction: systemPrompt,
      }
    });

    return response.text || "Xin lỗi, tôi không thể phân tích dữ liệu lúc này.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Đã có lỗi xảy ra khi kết nối với AI. Vui lòng kiểm tra API Key.";
  }
};