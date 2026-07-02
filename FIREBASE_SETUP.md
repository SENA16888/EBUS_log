# 🔥 Hướng Dẫn Firebase - Lưu Dữ Liệu Trên Cloud

## 📋 Vấn đề hiện tại
- ❌ Dữ liệu lưu trong `localStorage` (trình duyệt)
- ❌ Mỗi lần deploy trên Vercel, dữ liệu bị reset
- ❌ Không có backup dữ liệu

## ✅ Giải pháp
- ✅ Dữ liệu được lưu trên **Firebase Cloud** (Google)
- ✅ Tất cả nhân sự đều thấy cùng 1 database
- ✅ Dữ liệu không bao giờ mất khi push GitHub

---

## 📺 BƯỚC 1: Tạo Firebase Project

1. **Truy cập Firebase Console:**
   - Mở: https://console.firebase.google.com/
   - Đăng nhập với Google account

2. **Tạo Project mới:**
   - Click nút **"Thêm dự án"** / **"Create Project"**
   - Nhập tên: **`ebus-log`**
   - Chọn Country: **Vietnam**
   - Bỏ tick "Enable Google Analytics" (không cần)
   - Click **"Create Project"**
   - Chờ 1-2 phút cho Firebase initialize

---

## 📺 BƯỚC 2: Bật Firestore Database

1. **Tại Firebase Console:**
   - Chọn project **`ebus-log`**
   - Ở menu bên trái → Tìm **"Firestore Database"**
   - Click **"Firestore Database"**

2. **Tạo Database:**
   - Click **"Create database"**
   - Chọn: **"Start in test mode"** (dễ phát triển)
   - Region: **asia-southeast1** (gần Việt Nam)
   - Click **"Create"**
   - Chờ ~2 phút

---

## 📺 BƯỚC 3: Lấy Firebase Configuration

1. **Vào Project Settings:**
   - Ở góc trên cùng → Click icon **⚙️ (Bánh răng)**
   - Chọn **"Project settings"**

2. **Tìm Web App Config:**
   - Cuộn xuống → Tìm section **"Your apps"**
   - Nếu chưa có web app, click **"</>"** icon
   - Copy toàn bộ config object:
   ```javascript
   {
     "apiKey": "AIzaSyD...",
     "authDomain": "ebus-log.firebaseapp.com",
     "projectId": "ebus-log",
     "storageBucket": "ebus-log.appspot.com",
     "messagingSenderId": "123456789",
     "appId": "1:123456789:web:abcdef1234567890"
   }
   ```

---

## 📺 BƯỚC 4: Cấu hình .env.local (Local Development)

1. **Mở VS Code**
2. **Tạo file `.env.local` ở thư mục gốc:**
   ```
   VITE_GEMINI_API_KEY=your_gemini_key_here
   VITE_FIREBASE_API_KEY=AIzaSyD...
   VITE_FIREBASE_AUTH_DOMAIN=ebus-log.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=ebus-log
   VITE_FIREBASE_STORAGE_BUCKET=ebus-log.appspot.com
   VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
   VITE_FIREBASE_APP_ID=1:123456789:web:abcdef1234567890
   ```

3. **Cấu hình Firestore Security Rules:**
   - Tại Firebase Console → **Firestore Database**
   - Click tab **"Rules"**
   - Thay thế toàn bộ bằng:
   ```firestore
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if true;
       }
     }
   }
   ```
   - Click **"Publish"**

4. **Bật Firebase Storage cho file âm thanh phát thanh:**
   - Tại Firebase Console → **Storage**
   - Click **"Get started"** / **"Bắt đầu"**
   - Chọn region gần Việt Nam nếu được hỏi
   - Vào tab **"Rules"**
   - Dùng rules phát triển:
   ```firestore
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read, write: if true;
       }
     }
   }
   ```
   - Click **"Publish"**

5. **Restart dev server:**
   ```bash
   npm run dev
   ```

---

## 📺 BƯỚC 5: Cấu hình Vercel Environment Variables

### ⚠️ QUAN TRỌNG: Không được hardcode Firebase key trong code!

1. **Truy cập Vercel Dashboard:**
   - https://vercel.com/dashboard

2. **Vào Project → Settings:**
   - Click vào project **EBUS_log**
   - Tab **"Settings"**
   - Tìm **"Environment Variables"** ở menu bên trái

3. **Thêm các biến:**
   - Click **"Add New"**
   - Thêm từng cái:
     ```
     VITE_FIREBASE_API_KEY = AIzaSyD...
     VITE_FIREBASE_AUTH_DOMAIN = ebus-log.firebaseapp.com
     VITE_FIREBASE_PROJECT_ID = ebus-log
     VITE_FIREBASE_STORAGE_BUCKET = ebus-log.appspot.com
     VITE_FIREBASE_MESSAGING_SENDER_ID = 123456789
     VITE_FIREBASE_APP_ID = 1:123456789:web:abcdef
     VITE_GEMINI_API_KEY = your_gemini_key
     ```

4. **Redeploy trên Vercel:**
   - Vào tab **"Deployments"**
   - Click **3 dots** → **Redeploy** tại deployment mới nhất
   - Hoặc: Push một commit lên GitHub để tự động deploy

---

## 🧪 KIỂM TRA XEM CÓ HOẠT ĐỘNG KHÔNG

1. **Trên localhost:**
   - Mở http://localhost:5173
   - Thêm 1 thiết bị/sự kiện nào đó
   - Refresh trang → Dữ liệu vẫn còn ✅

2. **Trên Vercel:**
   - Mở ứng dụng Vercel
   - Thêm 1 thiết bị
   - Refresh trang → Dữ liệu vẫn còn ✅
   - **Điều này chứng tỏ Firebase hoạt động!**

3. **Kiểm tra trong Firebase Console:**
   - Vào **Firestore Database** → **Data**
   - Nhìn thấy collection **`appState`** ✅

---

## 🚀 HƯỚNG DẪN TẠO VERCEL PROJECT (nếu chưa)

1. **Vercel không yêu cầu backend, chỉ cần:**
   - GitHub repo
   - Kết nối Vercel với GitHub
   - Auto deploy mỗi khi push

2. **Bước cơ bản:**
   - Push code hiện tại lên GitHub
   - Truy cập: https://vercel.com/new
   - Chọn repo `EBUS_log`
   - Import
   - Add Environment Variables (như trên)
   - Deploy

---

## ❓ Có vấn đề?

**Q: "Dữ liệu vẫn mất sau khi deploy"**
- A: Kiểm tra Firebase config có đúng không trong Vercel Environment Variables

**Q: "Lỗi: 'auth/invalid-api-key'"**
- A: Sai Firebase API Key, copy lại từ Firebase Console

**Q: "Chỉ mình thấy dữ liệu, mình khác không thấy"**
- A: Họ cần load lại trang, Firebase đồng bộ realtime

**Q: "Làm sao xóa tất cả dữ liệu trên Firebase?"**
- A: Vào Firestore → Collections → Chọn → Delete

---

## 📞 Support
Nếu gặp lỗi, kiểm tra:
1. Firebase Project ID có đúng không?
2. Firestore Rules có được Publish không?
3. Vercel Environment Variables có setup đúng không?
4. Browser console (F12) có error gì không?

**Chúc bạn thành công! 🎉**
