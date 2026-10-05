const autocannon = require('autocannon');

function runScenario(options) {
  return new Promise((resolve) => {
    autocannon(options, (error, result) => {
      if (error) {
        resolve({
          title: options.title,
          error,
        });
        return;
      }

      const errorRate = result.non2xx / Math.max(1, result.requests.total);
      resolve({
        title: options.title,
        latencyP95: result.latency.p95,
        errors: result.errors,
        non2xx: result.non2xx,
        requests: result.requests.total,
        errorRate,
      });
    });
  });
}

module.exports = {
  runScenario,
};
