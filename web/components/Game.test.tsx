import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Game } from "./Game";

const FIXED_PUZZLE = {
  day: 1,
  target_hint: Buffer.from("kitchen").toString("base64"),
  ranks: { kitchen: 1, sink: 2, tile: 300 },
  vocab_size: 3,
};

beforeEach(() => {
  window.localStorage.clear();
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => FIXED_PUZZLE,
  }) as unknown as typeof fetch;
});

afterEach(() => {
  jest.restoreAllMocks();
});

test("guessing rank 1 transitions the game into the win state", async () => {
  const user = userEvent.setup();
  render(<Game />);

  const input = await screen.findByLabelText("Enter a guess");

  // A non-winning guess first, so "Solved in N guesses" has something to count.
  await user.type(input, "sink");
  await user.keyboard("{Enter}");
  expect(screen.queryByTestId("revealed-target")).not.toBeInTheDocument();

  await user.type(input, "kitchen");
  await user.keyboard("{Enter}");

  expect(await screen.findByTestId("revealed-target")).toHaveTextContent("kitchen");
  expect(screen.getByText("Solved in 2 guesses")).toBeInTheDocument();
  expect(screen.queryByLabelText("Enter a guess")).not.toBeInTheDocument();

  const shareButton = screen.getByRole("button", { name: /share/i });
  expect(shareButton).toBeDisabled();
});

test("a duplicate guess shows an inline message and does not clear the input", async () => {
  const user = userEvent.setup();
  render(<Game />);

  const input = await screen.findByLabelText("Enter a guess");
  await user.type(input, "sink");
  await user.keyboard("{Enter}");
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
