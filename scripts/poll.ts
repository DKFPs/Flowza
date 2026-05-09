import axios from "axios";

async function poll() {
  for (let i = 0; i < 20; i++) {
    try {
      await axios.get("http://localhost:3000/api/health");
      console.log("UP!");
      return;
    } catch(e) {
      console.log("Waiting...");
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}
poll();
