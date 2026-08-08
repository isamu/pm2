// The ES-module twin of reports-back.js, for the import() branch of ProcessContainerFork.
if (process.send) process.send({ ran: true, esm: true });
