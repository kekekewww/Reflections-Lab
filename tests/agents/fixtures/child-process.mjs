const mode = process.argv[2];
if (mode === "failure") {
  process.stdout.write('{"type":"completed"}\n');
  process.exitCode = 7;
} else if (mode === "hang") {
  setTimeout(() => process.exit(19), 10000);
  setInterval(() => process.stdout.write("alive\n"), 100);
} else if (mode === "flood") {
  setTimeout(() => process.exit(19), 10000);
  setInterval(() => process.stdout.write("x".repeat(4096)), 5);
} else if (mode === "secret") {
  process.stdout.write("api_key=sk-sec");
  setTimeout(() => process.stdout.write(`ret-value ${process.env.REFLECTION_TEST_API_KEY}\n`), 10);
} else if (mode === "unicode") {
  process.stdout.write("你".repeat(20));
} else {
  process.exitCode = 2;
}
