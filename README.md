# Frame Composer

這個專案現在已經整理成比較適合長期維護的靜態網站結構：

- `index.html`：畫面結構
- `assets/css/styles.css`：樣式
- `assets/js/app.js`：功能邏輯
- `server.js`：本機預覽與 Zeabur 啟動用的靜態伺服器

## 本機執行

```bash
npm start
```

打開瀏覽器進入：

```text
http://localhost:3000
```

## 推到 GitHub

```bash
git init
git add .
git commit -m "Refactor project structure"
git branch -M main
git remote add origin <你的 GitHub Repo URL>
git push -u origin main
```

## 部署到 Zeabur

1. 把 GitHub repo 連到 Zeabur
2. 匯入這個專案
3. Zeabur 會讀到 `package.json`
4. 啟動指令會用 `npm start`
5. 部署完成後，Zeabur 會給你一個公開網址

## 補充

這是純前端工具，沒有資料庫需求，所以部署會相對簡單。
