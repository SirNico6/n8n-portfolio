# How this work is built and delivered

The conventions, delivery checklist and quoting rule used across the cases in
this repo. Published as part of the portfolio: it is how the work is done, not
just what was produced.

This is not knowledge about n8n — that lives in `kb/`. This is **how the work is
done here**.

## Before building

Check `kb/gotchas/` for the service you are about to integrate. If there is no
file, create one when you finish.

## Build conventions

- **Node names say what they do, not which node they are.** `Validate payload`,
  not `Code1`.
- **Validation comes first.** Something comes in, it gets validated before any
  external system is touched. A public webhook without validation is a
  vulnerability.
- **Error handling, always.** No workflow is finished without an explicit error
  path and an Error Trigger that notifies.
- **No hardcoded credentials.** They live in n8n credentials, never in Code nodes
  or URLs.
- **Native node before Code node.** Code is justified when there is no native
  option.
- **One workflow does one thing.** Error handling lives in its own workflow.
- **Everything published is in English.** Code, comments, node names, filenames,
  documentation, and the error messages a workflow returns.

## Delivery checklist

- [ ] Runs end to end with real test data
- [ ] Fails in a controlled way on invalid payload, service down and rate limit
- [ ] Nothing is lost: whatever fails after retries is recorded
- [ ] The client can see what happened to each execution
- [ ] No credentials in the exported JSON
- [ ] Documentation delivered (see below)

## What the client receives

Never raw JSON with no explanation. The deliverable is:

1. **Workflow Design & Integration Mapping** — which nodes, which integrations,
   how the data flows
2. **Process Flow Diagram** — the flow, visually
3. **Testing Notes & Validation Checklist** — scenarios tested, results, known
   limitations
4. **Handover Summary** — setup, credential configuration, how to activate,
   maintenance
5. **Importable JSON** of the finished workflow

This list is not invented: it is what good Upwork clients ask for verbatim.
Copying it aligns the deliverable with what the market is already requesting.

## Quoting

**Fixed price for fixed scope. Never hourly.** Hourly pays for slowness and
punishes speed, which is exactly the advantage.

To quote:

1. Break the request into concrete, countable deliverables
2. Write down explicitly what it does **not** include
3. Define what counts as a scope change and is billed separately
4. If it cannot be scoped, the first deliverable is a paid, bounded diagnosis
