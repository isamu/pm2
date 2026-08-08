// Loaded by ProcessContainerFork under test: reports what the container set up around it.
if (process.send) {
  process.send({
    ran: true,
    title: process.title,
    isMainLoaded: process.mainModule ? process.mainModule.loaded : null,
  });
}
