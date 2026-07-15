
const sk = process.env.STRIPE_SECRET_KEY;
if (!sk) {
  console.log("NOT FOUND");
} else {
  console.log("Prefix:", sk.substring(0, 3));
  console.log("Length:", sk.length);
  console.log("Is sk_test or sk_live:", sk.startsWith("sk_test") || sk.startsWith("sk_live"));
}
