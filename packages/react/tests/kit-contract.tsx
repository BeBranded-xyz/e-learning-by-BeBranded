import { render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { UiKit } from "../src/ui/kit.types.js";
import { a11yViolations } from "./render.js";

/**
 * The UI kit contract (spec 11): what the module relies on from any kit.
 * Roles, accessible names, forwarded attributes and handlers, disabled states,
 * no axe violation. Run it on every kit: `describeKitContract("my kit", myKit)`.
 */
export function describeKitContract(name: string, kit: UiKit): void {
  describe(`UI kit contract: ${name}`, () => {
    describeActions(kit);
    describeDisplay(kit);
    describeFields(kit);
    describeChoiceFields(kit);
    describeTable(kit);
  });
}

function describeActions({ Button, LinkButton }: UiKit) {
  it("Button: a named button that forwards its handler, id and ARIA", async () => {
    const onClick = vi.fn();
    render(
      <Button id="go" aria-describedby="hint" variant="primary" onClick={onClick}>
        Go
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Go" });

    await userEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(button.id).toBe("go");
    expect(button.getAttribute("aria-describedby")).toBe("hint");
    expect(button.getAttribute("type")).toBe("button");
  });

  it("Button: disabled, it ignores clicks", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Wait
      </Button>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Wait" }));

    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Wait" }).hasAttribute("disabled")).toBe(true);
  });

  it("Button: type submit submits its form", async () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => {
      event.preventDefault();
    });
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit" variant="destructive" size="sm">
          Send
        </Button>
      </form>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Send" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("LinkButton: a named link to its href", () => {
    render(
      <LinkButton href="/next" variant="ghost">
        Next
      </LinkButton>,
    );

    expect(screen.getByRole("link", { name: "Next" }).getAttribute("href")).toBe("/next");
  });
}

function describeDisplay({ Alert, Badge, Card, Progress }: UiKit) {
  it("Card, Badge and Alert: their content, element and forwarded attributes", () => {
    render(
      <>
        <Card as="article" aria-label="Course">
          Inside
        </Card>
        <Badge tone="success" data-status="completed">
          Done
        </Badge>
        <Alert tone="error" role="alert">
          Broken
        </Alert>
      </>,
    );

    expect(screen.getByRole("article", { name: "Course" }).textContent).toContain("Inside");
    expect(screen.getByText("Done").closest("[data-status]")?.getAttribute("data-status")).toBe(
      "completed",
    );
    expect(screen.getByRole("alert").textContent).toContain("Broken");
  });

  it("Progress: a named progress bar with its value text", () => {
    render(<Progress value={0.4} label="Progress: Safety" valueText="40%" />);

    expect(screen.getByRole("progressbar", { name: "Progress: Safety" })).toBeDefined();
    expect(document.body.textContent).toContain("40%");
  });
}

function describeFields({ TextArea, TextField }: UiKit) {
  it("TextField and TextArea: labelled, controlled, with their constraints", async () => {
    const onTitle = vi.fn();
    const onSummary = vi.fn();
    render(
      <>
        <TextField label="Title" value="" onChange={onTitle} required maxLength={20} />
        <TextArea label="Summary" value="" onChange={onSummary} disabled />
      </>,
    );

    await userEvent.type(screen.getByLabelText("Title"), "A");

    expect(onTitle).toHaveBeenLastCalledWith("A");
    expect(screen.getByLabelText("Title").hasAttribute("required")).toBe(true);
    expect(screen.getByLabelText("Title").getAttribute("maxlength")).toBe("20");
    expect(screen.getByLabelText("Summary").hasAttribute("disabled")).toBe(true);
  });

  it("TextField: suggests from a datalist and asks for a numeric keyboard", () => {
    render(
      <>
        <TextField label="Role" value="" onChange={vi.fn()} list="roles" />
        <TextField label="Grade" value="" onChange={vi.fn()} inputMode="numeric" />
        <datalist id="roles" />
      </>,
    );

    expect(screen.getByLabelText("Role").getAttribute("list")).toBe("roles");
    expect(screen.getByLabelText("Grade").getAttribute("inputmode")).toBe("numeric");
  });
}

function describeChoiceFields({ Checkbox, Select, TextArea, TextField }: UiKit) {
  it("Select: labelled, reports the chosen option's value", async () => {
    const onChange = vi.fn();
    render(
      <Select
        label="Mode"
        value="self"
        onChange={onChange}
        options={[
          { value: "self", label: "Anyone" },
          { value: "assigned", label: "Assigned only" },
        ]}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText("Mode"), "assigned");

    expect(onChange).toHaveBeenLastCalledWith("assigned");
  });

  it("Checkbox: labelled, reports its new state", async () => {
    const onChange = vi.fn();
    render(<Checkbox label="Learners can download" checked={false} onChange={onChange} />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Learners can download" }));

    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it("each field is one box, its label inside, so a row of fields lines up", () => {
    const { container } = render(
      <>
        <TextField label="Title" value="" onChange={vi.fn()} />
        <TextArea label="Summary" value="" onChange={vi.fn()} />
        <Select label="Mode" value="a" onChange={vi.fn()} options={[{ value: "a", label: "A" }]} />
      </>,
    );
    const fields = ["Title", "Summary", "Mode"].map((name) => ({
      box: screen.getByText(name, { selector: "label" }).parentElement,
      control: screen.getByLabelText(name),
    }));

    expect(fields.map(({ box }) => box === container)).toEqual([false, false, false]);
    expect(fields.map(({ box, control }) => box?.contains(control))).toEqual([true, true, true]);
  });
}

function describeTable(kit: UiKit) {
  const { Table } = kit;
  it("Table: captioned, with column headers and a header cell per row", () => {
    render(
      <Table
        caption="Enrollments"
        columns={[
          { key: "learner", header: "Learner" },
          { key: "progress", header: "Progress" },
        ]}
        rows={[{ key: "a", cells: ["learner-1", "40%"] }]}
      />,
    );
    const table = screen.getByRole("table", { name: "Enrollments" });

    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((cell) => cell.textContent),
    ).toEqual(["Learner", "Progress"]);
    expect(within(table).getByRole("rowheader").textContent).toBe("learner-1");
    expect(within(table).getByRole("cell").textContent).toBe("40%");
  });

  it("has no axe violation, every primitive together", async () => {
    const { container } = render(<Everything kit={kit} />);

    expect(await a11yViolations(container)).toEqual([]);
  });
}

function Everything({ kit }: { readonly kit: UiKit }) {
  const { Alert, Badge, Button, Card, Checkbox, LinkButton, Progress, Select, TextField } = kit;
  const noop = () => undefined;
  return (
    <main>
      <Card as="section" aria-label="Everything">
        <Button variant="primary">Primary</Button>
        <LinkButton href="/x">Link</LinkButton>
        <Badge tone="warning">Late</Badge>
        <Alert tone="info">Note</Alert>
        <Progress value={0.5} label="Half" valueText="50%" />
        <TextField label="Name" value="" onChange={noop} />
        <Select label="Pick" value="a" onChange={noop} options={[{ value: "a", label: "A" }]} />
        <Checkbox label="Agree" checked onChange={noop} />
      </Card>
    </main>
  );
}
