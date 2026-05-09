import axios from "axios";
async function check() {
  const storeRes = await axios.get("http://localhost:3000/api/mockstore");
  console.log("Response:", storeRes.data);
}
check();
