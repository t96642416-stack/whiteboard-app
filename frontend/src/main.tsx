import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// /admin 은 관리자 화면 — 별도 파일로 나눠 일반 사용자 로딩에는 영향 없음
const AdminApp = lazy(() => import("./admin/AdminApp"));
const isAdmin = window.location.pathname.replace(/\/+$/, "") === "/admin";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isAdmin ? (
      <Suspense fallback={<div className="p-8 text-sm text-gray-500">불러오는 중…</div>}>
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>
);
