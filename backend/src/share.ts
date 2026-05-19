import localtunnel from "localtunnel";

const PORT = parseInt(process.env.PORT || "3001");

async function openTunnel() {
  console.log(`\n🌐 공유 링크 생성 중... (포트 ${PORT})`);

  try {
    const tunnel = await localtunnel({ port: PORT });

    console.log("\n✅ 공유 링크가 생성됐어요!\n");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`🔗 팀원에게 이 링크를 보내세요:`);
    console.log(`\n   ${tunnel.url}\n`);
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log("⚠️  처음 접속 시 'Click to Continue' 버튼을 눌러야 해요");
    console.log("⚠️  이 터미널을 닫으면 링크도 꺼져요\n");

    tunnel.on("close", () => {
      console.log("\n🔴 터널이 닫혔습니다.");
      process.exit(0);
    });

    tunnel.on("error", (err: Error) => {
      console.error("터널 오류:", err.message);
    });

    // Ctrl+C로 종료 시 터널도 닫기
    process.on("SIGINT", () => {
      console.log("\n터널을 닫는 중...");
      tunnel.close();
      process.exit(0);
    });
  } catch (err) {
    console.error("터널 생성 실패:", err);
    process.exit(1);
  }
}

openTunnel();
