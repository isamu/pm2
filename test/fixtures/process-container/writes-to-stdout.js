// Loaded by ProcessContainer, which by then has replaced process.stdout.write. Reports what the
// replacement answered so the test can see it, rather than only seeing the log line.
var returned = process.stdout.write('hello from the app\n');

process.send({
  type: 'test:report',
  returned: returned,
  returned_type: typeof returned,
});
