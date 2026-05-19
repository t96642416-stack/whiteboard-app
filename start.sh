#!/bin/bash

# 협업 화이트보드 시작 스크립트
echo "🚀 협업 화이트보드를 시작합니다..."
echo ""

# API 키 확인
if grep -q "your_api_key_here" /Users/parksuhyun/project/backend/.env 2>/dev/null; then
  echo "⚠️  경고: backend/.env 파일에서 ANTHROPIC_API_KEY를 실제 키로 교체해주세요."
  echo ""
fi

# 백엔드 시작
echo "📡 백엔드 서버 시작 (포트 3001)..."
cd /Users/parksuhyun/project/backend && npm run dev &
BACKEND_PID=$!

sleep 2

# 프론트엔드 시작
echo "🌐 프론트엔드 시작 (포트 5173)..."
cd /Users/parksuhyun/project/frontend && npm run dev &
FRONTEND_PID=$!

echo ""
echo "✅ 서버가 시작되었습니다!"
echo "   프론트엔드: http://localhost:5173"
echo "   백엔드:     http://localhost:3001"
echo ""
echo "종료하려면 Ctrl+C를 누르세요."

# 종료 시 프로세스 정리
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; echo '서버를 종료합니다.'" EXIT

wait
