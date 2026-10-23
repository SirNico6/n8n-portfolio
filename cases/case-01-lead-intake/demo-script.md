# Demo script — case 01

A four-minute video. Screen recording, no face, no music, no animated intro.

**The rule:** none of this gets narrated as a claim. All of it gets shown
happening live. If a moment cannot be shown, it does not go in.

## Before recording

- [ ] n8n running, all three workflows published
- [ ] HubSpot open on *Contacts*, sorted by creation date descending
- [ ] The `lead_dead_letter` table **empty** (`clear` from the node or the API)
- [ ] Test contacts deleted from HubSpot, except the two sample ones
- [ ] Terminal with a large font, in the case directory
- [ ] Telegram visible if notifications are configured
- [ ] Two windows: terminal on the left, browser on the right

Rehearse it once end to end before recording. The value is in the pacing, not in
the content: the content is already measured.

---

## 0:00 – 0:25 · The hook

**On screen:** workflow A on the n8n canvas. Four nodes, tidy.

**You say:**

> This is the most common lead capture flow there is. Form, map fields, CRM,
> notify the team. Four nodes. It works.
>
> I'm going to send it eight real form submissions. Not made up: real. An email
> with an extra space, somebody who hit Submit twice, an empty field.
>
> Watch how many arrive.

Do not mention yet that there is a second version.

---

## 0:25 – 1:20 · Breaking A live

**You do:**

```bash
bash fixtures/send.sh http://localhost:5678/webhook/lead-intake-naive
```

**On screen:** the output running. `HTTP 500` appears six times.

**You say, while it runs:**

> Two hundred. Five hundred. Five hundred. Five hundred. Two hundred. Five
> hundred. Five hundred. Five hundred.
>
> Six out of eight. And look at the error body: `Error in workflow`. That is
> everything the form receives. That is everything the visitor sees.

**Pause on the output for a second.** Let it be read.

---

## 1:20 – 2:00 · Where the lead went

**On screen:** HubSpot, contact list. There is one new contact. One.

**You say:**

> Eight people filled in the form. There is one in the CRM.

**Switch to n8n → A's Executions.** Open the run for fixture `03`. Zoom into the
red HubSpot node.

**You say:**

> Here is the best one of all. The email that went in was — point at the input —
> space, space, L-U-C-I-A dot B-E-N-I-T-E-Z at, with whitespace on both sides.
>
> And the error HubSpot returns reads: *Email address
> LUCIA.BENITEZ@Example.COM is invalid*. Without the whitespace.
>
> So: it shows you an email that looks perfectly valid and tells you it is
> invalid. The space, which is the cause, appears nowhere in the message.
>
> If somebody calls you about this, you will look at the email, you will see it
> is fine, and you will spend an hour looking in the wrong place.

**This is the most important part of the video.** Do not rush it.

---

## 2:00 – 2:20 · The turn

**You say, without changing screens:**

> Now. Nothing that follows changes the CRM. Same HubSpot, same account, same
> eight submissions.
>
> The only difference is the workflow.

---

## 2:20 – 3:10 · The same eight against B

**On screen:** B's canvas. Leave it for two seconds: it is visibly bigger, but do
not walk through it node by node. Nobody cares.

**You do:**

```bash
bash fixtures/send.sh http://localhost:5678/webhook/lead-intake
```

**On screen:** the output. No `500` anywhere.

**You say:**

> No five hundreds.
>
> The ones that get in, get in. The ones that get rejected say why — point at it
> — `invalid email: diego.pereyra@@example`. `missing required field: email`.
> `payload too large`.
>
> That is an error somebody can act on.

---

## 3:10 – 3:35 · The duplicate, which is the argument

**On screen:** n8n → B's Executions → the run for fixture `05b`. Open the *Drop
duplicates* node. **Show that the output is 0 items.**

**You say:**

> This is the same lead as before, typed differently: capitals and whitespace.
>
> In the previous version this returned a five hundred and the lead disappeared.
> Here the deduplication node recognised it as a repeat. Output: zero.
>
> It was not loaded twice. And nobody is going to call them twice.
>
> What changed? Somebody trimmed a space before asking.

---

## 3:35 – 4:00 · What still fails

**On screen:** the `lead_dead_letter` table with its rows.

**You say:**

> And this is the one that still failed. A payload with code inside it, which the
> CRM blocks. In the previous version it evaporated.
>
> Here it is: the email, the complete payload, which node failed, and the link to
> the execution.
>
> It is not that nothing fails. It is that nothing is lost.

If Telegram is configured, show the alert arriving, with its link.

---

## 4:00 – 4:20 · Close

**On screen:** the A vs B table from `results-A-vs-B.md`.

**You say:**

> Six out of eight against zero out of eight. Same data, same CRM.
>
> If you have an automation that works most of the time, that is the one I want
> to see. Send me what breaks and I'll tell you whether I can fix it.

**Cut there.** No "subscribe", no logo, no end card.

---

## Editing notes

- **No music.** It competes with the voice and the content does not need it.
- **Cut the dead time.** Every `curl` that takes two seconds, cut it. But **do not
  cut the fixture run**: seeing it actually execute is the proof it is not staged.
- **Zoom where it matters.** Three moments: HubSpot's error message without the
  whitespace, the `0` output of the deduplication node, the queue row. Those
  three shots are the video.
- **No on-screen text**, except subtitles. Captions with arrows make it look like
  an ad.
- **Show the errors that remain.** Do not edit out the `500` from the injection
  fixture in B. The robust version also having a failing case is what makes the
  rest believable.

## 60-second cut

For posting standalone or attaching to a proposal:

1. `0:00-0:10` — "Eight real form submissions against a normal lead capture flow."
2. `0:10-0:25` — A's run. Six `500`s going past.
3. `0:25-0:40` — HubSpot's error without the whitespace. Zoom.
4. `0:40-0:55` — B's run. No `500`.
5. `0:55-1:00` — "Same CRM, same data. The only difference is the workflow."
