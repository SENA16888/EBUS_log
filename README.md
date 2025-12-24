<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1HBVyrXxCFLk_4t9qtuSF-CTMNab7OEQl

## ⚠️ QUAN TRỌNG: Cấu hình Firebase (Để dữ liệu không mất khi deploy)

**BẮT BUỘC để tránh mất dữ liệu khi push GitHub/Vercel!**

### 1. Tạo Firebase Project
- Truy cập: https://console.firebase.google.com/
- Click "Thêm dự án" / "Add Project"
- Nhập tên: `ebus-log`
- Hoàn thành quá trình tạo

### 2. Tạo Firestore Database
- Vào **Firestore Database** → Click "Create Database"
- Chế độ: **Start in test mode**
- Region: **asia-southeast1**

### 3. Lấy Firebase Config
- Vào **Project Settings** (⚙️ icon)
- Cuộn xuống → Copy thông tin dưới "Your apps"

### 4. Tạo file `.env.local` với:
```
VITE_GEMINI_API_KEY=your_api_key_here
VITE_FIREBASE_API_KEY=AIzaSyDxxxxxxxxxx
VITE_FIREBASE_AUTH_DOMAIN=ebus-log.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ebus-log
VITE_FIREBASE_STORAGE_BUCKET=ebus-log.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### 5. Firestore Security Rules
Vào **Firestore Database** → **Rules** → Paste:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

### 6. Vercel Environment Variables
Tại Vercel Dashboard:
- Project → Settings → Environment Variables
- Thêm tất cả `VITE_FIREBASE_*` variables
- **CHỈ `VITE_` prefix mới được expose ra client**

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Create a `.env.local` file and set your Gemini API key (Vite only exposes keys prefixed with `VITE_`):

```
VITE_GEMINI_API_KEY=your_api_key_here
```
3. Run the app:
   `npm run dev`

