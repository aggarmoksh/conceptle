import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Game } from "./Game";

const FIXED_PUZZLE = {
  day: 1,
  target_hint: Buffer.from("kitchen").toString("base64"),
  ranks: {
    kitchen: 1,
    sink: 2,
    tile: 300,
    hunter: 10,
    // All-letters and mutually distinct after normalizeGuess (which strips
    // digits) -- "wrong1".."wrong6" would all collapse to the same "wrong"
    // string and silently break these tests.
    wrongone: 5000,
    wrongtwo: 5001,
    wrongthree: 5002,
    wrongfour: 5003,
    wrongfive: 5004,
    wrongsix: 5005,
    // Phase 2.5.1 Fix B: the 5 fixed probe words.
    animal: 40,
    place: 900,
    tool: 1600,
    feeling: 2000,
    action: 2200,
  },
  vocab_size: 16,
};

// Phase 1.5.1: matches the shape of the real pipeline's forms.json.
const FIXED_FORMS = { hunters: "hunter" };
// Phase 2.5: category/attribute fixtures.
const FIXED_CATEGORIES = { sink: "appliance" };
const FIXED_ATTRIBUTES = { day: 1, attributes: { sink: "both hold water" } };

function mockFetch() {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("forms.json")) {
      return Promise.resolve({ ok: true, json: async () => FIXED_FORMS });
    }
    if (url.includes("categories.json")) {
      return Promise.resolve({ ok: true, json: async () => FIXED_CATEGORIES });
    }
    if (url.includes("/attributes/")) {
      return Promise.resolve({ ok: true, json: async () => FIXED_ATTRIBUTES });
    }
    return Promise.resolve({ ok: true, json: async () => FIXED_PUZZLE });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  window.localStorage.clear();
  mockFetch();
  // No manual clipboard mock needed: @testing-library/user-event's setup()
  // installs its own fully-functional Clipboard stub on navigator.clipboard
  // (real writeText/readText backed by an in-memory store) the moment
  // userEvent.setup() runs in each test below. Installing a competing
  // jest.fn()-based mock here gets silently overwritten by that stub, so
  // ShareButton's writeText calls are verified by reading the real stub back
  // via navigator.clipboard.readText() instead of a mock call assertion.
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function submitGuessByTyping(user: ReturnType<typeof userEvent.setup>, word: string) {
  const input = await screen.findByLabelText("Enter a guess");
  await user.type(input, word);
  await user.keyboard("{Enter}");
}

test("guessing rank 1 transitions the game into the win state", async () => {
  const user = userEvent.setup();
  render(<Game />);

  // A non-winning guess first, so "Solved in N/6" has something to count.
  await submitGuessByTyping(user, "sink");
  expect(screen.queryByTestId("revealed-target")).not.toBeInTheDocument();

  await submitGuessByTyping(user, "kitchen");

  expect(await screen.findByTestId("revealed-target")).toHaveTextContent("kitchen");
  expect(screen.getByText("Solved in 2/6")).toBeInTheDocument();
  expect(screen.queryByLabelText("Enter a guess")).not.toBeInTheDocument();

  const shareButton = screen.getByRole("button", { name: /share/i });
  expect(shareButton).not.toBeDisabled();
});

test("the share button copies a leak-free share string on win", async () => {
  const user = userEvent.setup();
  render(<Game />);

  await submitGuessByTyping(user, "kitchen");
  const shareButton = await screen.findByRole("button", { name: /share/i });
  await user.click(shareButton);

  const copied = await navigator.clipboard.readText();
  expect(copied).toContain("Conceptle #1  1/6");
  expect(copied).not.toContain("kitchen"); // no category/attribute/target leaks
  expect(await screen.findByText("Copied to clipboard")).toBeInTheDocument();
});

test("losing after 6 wrong guesses shows the lose state with a live share button", async () => {
  const user = userEvent.setup();
  render(<Game />);

  for (const word of ["wrongone", "wrongtwo", "wrongthree", "wrongfour", "wrongfive", "wrongsix"]) {
    await submitGuessByTyping(user, word);
  }

  expect(await screen.findByTestId("revealed-target")).toHaveTextContent("kitchen");
  expect(screen.queryByLabelText("Enter a guess")).not.toBeInTheDocument();
  // wrongsix is rank 5005, best rank overall is wrongone at 5000: "tough one" tier.
  expect(screen.getByText("Tough one today. See you tomorrow, we all get one.")).toBeInTheDocument();
  expect(screen.getByText("See how close you were")).toBeInTheDocument();
  // "kitchen" appears twice: once as the revealed target, once as rank 1 in
  // the top-10 learning-moment list.
  expect(screen.getAllByText("kitchen")).toHaveLength(2);

  const shareButton = screen.getByRole("button", { name: /share/i });
  await user.click(shareButton);
  const copied = await navigator.clipboard.readText();
  expect(copied).toContain("Conceptle #1  X/6");
});

test("guesses-remaining counts down and disappears once the game ends", async () => {
  const user = userEvent.setup();
  render(<Game />);

  expect(await screen.findByText("6/6")).toBeInTheDocument();
  await submitGuessByTyping(user, "sink");
  expect(await screen.findByText("5/6")).toBeInTheDocument();

  await submitGuessByTyping(user, "kitchen");
  // Query by the GuessesRemaining component's own aria-label, not a bare
  // "/6" text match: "Solved in 2/6" also ends in "/6" and would otherwise
  // give a false negative here.
  expect(screen.queryByLabelText(/guesses remaining/)).not.toBeInTheDocument();
});

test("a duplicate guess shows an inline message and does not clear the input", async () => {
  const user = userEvent.setup();
  render(<Game />);

  await submitGuessByTyping(user, "sink");
  const input = await screen.findByLabelText("Enter a guess");
  await user.type(input, "sink");
  await user.keyboard("{Enter}");

  expect(screen.getByText("already guessed")).toBeInTheDocument();
  expect(input).toHaveValue("sink");
});

test("a guess not in today's dictionary shows an inline message and does not clear the input", async () => {
  const user = userEvent.setup();
  render(<Game />);

  const input = await screen.findByLabelText("Enter a guess");
  await user.type(input, "zzznotaword");
  await user.keyboard("{Enter}");

  expect(screen.getByText("not in dictionary")).toBeInTheDocument();
  expect(input).toHaveValue("zzznotaword");
});

test("a guess row shows its category chip and attribute phrase when present", async () => {
  const user = userEvent.setup();
  render(<Game />);

  await submitGuessByTyping(user, "sink");
  expect(await screen.findByText("appliance")).toBeInTheDocument();
  expect(screen.getByText("both hold water")).toBeInTheDocument();
});

// Phase 1.5.1 regression tests.
test("a surface form not itself in the rank table resolves via forms.json to its lemma's rank", async () => {
  const user = userEvent.setup();
  render(<Game />);

  await submitGuessByTyping(user, "hunters");

  // Displayed word is the surface form the player typed; rank is hunter's (10).
  expect(await screen.findByText("hunters")).toBeInTheDocument();
  expect(screen.getByText("10")).toBeInTheDocument();
  expect(screen.queryByText("not in dictionary")).not.toBeInTheDocument();
});

test("guessing the lemma then its surface form is treated as a duplicate", async () => {
  const user = userEvent.setup();
  render(<Game />);

  await submitGuessByTyping(user, "hunter");
  await submitGuessByTyping(user, "hunters");

  expect(screen.getByText("already guessed")).toBeInTheDocument();
  // Only one row in the guess list, not two.
  expect(screen.getAllByText(/^(hunter|hunters)$/)).toHaveLength(1);
});

// Phase 2.5.1 Fix B: probe panel (reinstated seed words, budget-free).
test("the probe panel shows on first load with the 5 fixed probe words", async () => {
  render(<Game />);
  await screen.findByText("Not sure where to start?");
  for (const word of ["animal", "place", "tool", "feeling", "action"]) {
    expect(screen.getByRole("button", { name: word })).toBeInTheDocument();
  }
});

test("a probe does not decrement guesses remaining", async () => {
  const user = userEvent.setup();
  render(<Game />);

  expect(await screen.findByText("6/6")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "animal" }));
  await screen.findByText("40"); // the probe's rank rendered in the list
  expect(screen.getByText("6/6")).toBeInTheDocument();
});

test("each probe button disappears after use and cannot be clicked again", async () => {
  const user = userEvent.setup();
  render(<Game />);

  await screen.findByText("Not sure where to start?");
  await user.click(screen.getByRole("button", { name: "animal" }));
  await screen.findByText("40");

  expect(screen.queryByRole("button", { name: "animal" })).not.toBeInTheDocument();
  // The other 4 remain available.
  for (const word of ["place", "tool", "feeling", "action"]) {
    expect(screen.getByRole("button", { name: word })).toBeInTheDocument();
  }
});

test("a probe row is visually distinguished (outlined) and labeled, and is excluded from the share string", async () => {
  const user = userEvent.setup();
  render(<Game />);

  await screen.findByText("Not sure where to start?");
  await user.click(screen.getByRole("button", { name: "animal" }));
  await screen.findByText("40");

  // Outlined style: a border color, not a solid rank-band background fill.
  const probeRow = screen.getByText("animal").closest("li")!;
  const inlineStyle = probeRow.getAttribute("style") ?? "";
  expect(inlineStyle).toContain("border-color");
  expect(inlineStyle).not.toContain("background");
  expect(screen.getByText("probe")).toBeInTheDocument();

  await submitGuessByTyping(user, "kitchen");
  const shareButton = await screen.findByRole("button", { name: /share/i });
  await user.click(shareButton);
  const copied = await navigator.clipboard.readText();
  expect(copied).not.toContain("animal");
  expect(copied).toBe("Conceptle #1  1/6\n🟪\nconceptle.com"); // only the 1 real guess, no probe square
});

test("the probe panel does not reappear after explicit dismissal", async () => {
  const user = userEvent.setup();
  render(<Game />);

  await screen.findByText("Not sure where to start?");
  await user.click(screen.getByRole("button", { name: "Dismiss suggestions" }));
  expect(screen.queryByText("Not sure where to start?")).not.toBeInTheDocument();

  // Still gone after further interaction (e.g. a probe use would have no
  // panel left to dismiss again, but a real guess shouldn't resurrect it).
  await submitGuessByTyping(user, "sink");
  expect(screen.queryByText("Not sure where to start?")).not.toBeInTheDocument();
});

test("the probe panel does not reappear after the first real guess, even without explicit dismissal", async () => {
  const user = userEvent.setup();
  render(<Game />);

  await screen.findByText("Not sure where to start?");
  await submitGuessByTyping(user, "sink");
  expect(screen.queryByText("Not sure where to start?")).not.toBeInTheDocument();
});

test("multiple probes can be used in sequence without the panel disappearing early", async () => {
  const user = userEvent.setup();
  render(<Game />);

  await screen.findByText("Not sure where to start?");
  await user.click(screen.getByRole("button", { name: "animal" }));
  await screen.findByText("40");
  expect(screen.getByText("Not sure where to start?")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "place" }));
  await screen.findByText("900");
  expect(screen.getByText("Not sure where to start?")).toBeInTheDocument();
});
