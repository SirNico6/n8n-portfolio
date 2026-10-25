#!/usr/bin/env node
/**
 * collector.js — a stand-in for the WhatsApp Cloud API send endpoint.
 *
 * Why a local collector is the instrument for this case:
 *
 * The question the comparison has to answer is "how many replies did this
 * workflow try to send, and to whom". That is a property of the workflow, not
 * of Meta. Asking Meta would add a token, a test number, a recipient
 * allowlist and a 24-hour expiry to a measurement that does not need any of
 * them, and it would make the result unreproducible for anybody without a
 * Meta app.
 *
 * So the measurement is taken one step earlier: point the workflow's
 * `api_base` at this server and count what arrives. Two replies to the same
 * inbound message show up as two requests here, which is exactly the failure
 * the case is about. Nobody needs an account to see it.
 *
 * It also removes a confound. Against the real API, a duplicate reply and a
 * reply rejected by a rate limit look similar from inside n8n. Here every
 * request is answered 200, so the only thing being measured is the
 * workflow's own behaviour.
 *
 * Usage:
 *   node collector.js [--port 8099]
 *   curl -s localhost:8099/__stats          # the summary as JSON
 *   curl -s 'localhost:8099/__stats?reset=1' # read it, then start counting again
 *   Ctrl-C                                  # prints the summary and exits
 *
 * Every other path and method answers 200 with a plausible Cloud API send
 * response, so the workflow under test cannot tell the difference.
 */

'use strict';

const http = require('http');

const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(
    [
      'collector.js — stands in for the WhatsApp Cloud API send endpoint.',
      '',
      'Answers every request 200 with a plausible send response, and counts',
      'what it was asked to send. Used so the A/B comparison needs no Meta',
      'credentials.',
      '',
      'Usage:',
      '  node collector.js [--port 8099]',
      '',
      'Options:',
      '  --port <n>   port to listen on (default 8099, or PORT)',
      '  --quiet      do not print a line per request',
      '  -h, --help   this text',
      '',
      'Endpoints:',
      '  GET /__stats           the summary as JSON',
      '  GET /__stats?reset=1   the summary, then the counters are cleared',
      '  anything else          200 and a fake Cloud API send response',
      '',
      'Point the workflow at it by setting the Config node\'s api_base to',
      '  http://host.docker.internal:8099   (n8n in Docker, collector on the host)',
      '  http://localhost:8099              (n8n and collector on the same host)',
    ].join('\n')
  );
  process.exit(0);
}

const portArg = args.indexOf('--port');
const PORT = Number(
  (portArg !== -1 && args[portArg + 1]) || process.env.PORT || 8099
);
const QUIET = args.includes('--quiet');

let requests = [];
let startedAt = new Date().toISOString();

function summary() {
  const byRecipient = {};
  for (const r of requests) {
    byRecipient[r.to] = (byRecipient[r.to] || 0) + 1;
  }
  return {
    since: startedAt,
    requests: requests.length,
    recipients: byRecipient,
    sent: requests,
  };
}

function printSummary() {
  const s = summary();
  console.log('');
  console.log('--- collector summary ---');
  console.log('requests received: ' + s.requests);
  for (const [to, n] of Object.entries(s.recipients)) {
    console.log('  to ' + to + ': ' + n);
  }
  for (const r of s.sent) {
    console.log('  ' + r.at + '  ' + r.to + '  ' + JSON.stringify(r.text));
  }
  console.log('-------------------------');
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/__stats') {
    const body = JSON.stringify(summary(), null, 2);
    if (url.searchParams.get('reset')) {
      requests = [];
      startedAt = new Date().toISOString();
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(body);
    return;
  }

  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    let parsed = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = null;
    }

    const to = (parsed && parsed.to) || 'unknown';
    const text =
      parsed && parsed.text && typeof parsed.text.body === 'string'
        ? parsed.text.body
        : parsed && parsed.type
          ? '[type=' + parsed.type + ', no text]'
          : raw.slice(0, 200);

    const entry = {
      n: requests.length + 1,
      at: new Date().toISOString(),
      method: req.method,
      path: url.pathname,
      to,
      text,
    };
    requests.push(entry);

    if (!QUIET) {
      console.log(
        '#' + entry.n + ' ' + req.method + ' ' + url.pathname +
          ' -> to=' + to + ' text=' + JSON.stringify(text)
      );
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        messaging_product: 'whatsapp',
        contacts: [{ input: to, wa_id: to }],
        messages: [
          {
            id: 'wamid.TEST' + String(entry.n).padStart(32, '0'),
            message_status: 'accepted',
          },
        ],
      })
    );
  });
});

process.on('SIGINT', () => {
  printSummary();
  server.close(() => process.exit(0));
});

server.listen(PORT, () => {
  console.log('collector listening on http://localhost:' + PORT);
  console.log('stats: http://localhost:' + PORT + '/__stats   (Ctrl-C for a summary)');
});
