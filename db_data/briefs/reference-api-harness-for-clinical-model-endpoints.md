## Context

Every model packaged as an API on this platform is tested by hand, against whatever payload its author had open at the time.

There is no shared harness, so nothing is comparable. Two endpoints solving the same clinical question are checked against two different sets of cases, by two people, on two different days — and the only thing their results have in common is that neither can be replayed.

Qualified validation costs a medical professional's time. Spending it on an endpoint that returns a 500 on the third case is the most expensive way to find a bug.

## Objective

What has to be shipped:

- One declarative case format, shared by every validation challenge: input, expected shape, and what counts as a pass.
- A runner that replays a case set against any endpoint and diffs the responses.
- A latency and error-rate report per endpoint, so a slow API is visible before a validator waits on it.
- A CI entry point, so a regression is caught before it reaches a human.

## Expected result

- A pull request from your branch, with the board reflecting what it contains.
- The harness run against at least one live challenge endpoint, and its report committed as the reference output.
