# 협업 화이트보드

팀이 실시간으로 아이디어 카드를 모으고, AI 에이전트가 그 아이디어를 여러 관점으로 분석해 주는 웹 기반 협업 보드입니다.
관리자 화면에서 방을 만들어 참가자를 초대하고, 연구용 행동 로그와 지표(유창성, 참여 균등도, AI 활용, 아이디어 구체화 등)를 확인·내보낼 수 있습니다.

- 참가자: https://whiteboard-app-production-3b5f.up.railway.app
- 관리자: https://whiteboard-app-production-3b5f.up.railway.app/admin

## 문서

| 문서 | 내용 |
|---|---|
| [개발문서.md](개발문서.md) | 빌드·배포 방법, 화면(UI) 구성, 기능별 동작 방식, 윈도우 지원 |
| [사용가이드.md](사용가이드.md) | 참가자용 사용법 |

## 기술 구성

React 18 + TypeScript + Vite · Node.js + Express + Socket.IO · PostgreSQL · Railway
AI: Google Gemini / Anthropic Claude · 음성 인식: 브라우저 Web Speech API

## 빠르게 실행하기

```bash
npm run build   # 프론트엔드 + 백엔드 빌드
npm start       # http://localhost:3001
```

자세한 내용(환경변수, 로컬 개발, 배포)은 [개발문서.md](개발문서.md) 2장을 보세요.
