// Synthetic training content for the demo: a fictional company, no real data.

const props = { backgroundColor: "default", textColor: "default", textAlignment: "left" } as const;
const text = (value: string, styles: Record<string, true> = {}) => ({
  type: "text" as const,
  text: value,
  styles,
});
let next = 0;
const id = () => `b${(next += 1).toString()}`;

const paragraph = (...content: ReturnType<typeof text>[]) => ({
  id: id(),
  type: "paragraph",
  props,
  content,
  children: [],
});
const heading = (level: 1 | 2 | 3, value: string) => ({
  id: id(),
  type: "heading",
  props: { ...props, level },
  content: [text(value)],
  children: [],
});
const bullet = (value: string) => ({
  id: id(),
  type: "bulletListItem",
  props,
  content: [text(value)],
  children: [],
});
const check = (value: string) => ({
  id: id(),
  type: "checkListItem",
  props: { ...props, checked: false },
  content: [text(value)],
  children: [],
});
const callout = (variant: string, value: string) => ({
  id: id(),
  type: "callout",
  props: { backgroundColor: "default", textColor: "default", variant },
  content: [text(value)],
  children: [],
});

export const welcomeLesson = [
  heading(2, "Why safety matters"),
  paragraph(
    text("At Acme Corp, everyone goes home safe. This course takes "),
    text("15 minutes", { bold: true }),
    text("."),
  ),
  callout("info", "Tip: you can come back to any lesson at any time."),
  bullet("Know where the exits are"),
  bullet("Report every incident"),
];

export const fireLesson = [
  heading(2, "When the alarm rings"),
  {
    id: id(),
    type: "table",
    props: { textColor: "default" },
    content: {
      type: "tableContent",
      columnWidths: [null, null],
      headerRows: 1,
      rows: [
        { cells: [[text("Step")], [text("Action")]] },
        { cells: [[text("1")], [text("Leave by the nearest exit")]] },
        { cells: [[text("2")], [text("Go to the meeting point")]] },
      ],
    },
    children: [],
  },
  check("I know my meeting point"),
  callout("warning", "Never use the elevators during a fire alarm."),
  {
    id: id(),
    type: "columnList",
    props: {},
    children: [
      {
        id: id(),
        type: "column",
        props: { width: 0.6 },
        children: [
          heading(3, "Do"),
          bullet("Close the doors behind you"),
          bullet("Help visitors out"),
        ],
      },
      {
        id: id(),
        type: "column",
        props: { width: 0.4 },
        children: [heading(3, "Don't"), bullet("Go back for your belongings")],
      },
    ],
  },
];

export const readingLesson = [
  {
    id: id(),
    type: "toggleListItem",
    props,
    content: [text("What counts as an incident?")],
    children: [paragraph(text("Any event that could have hurt someone."))],
  },
  {
    id: id(),
    type: "quote",
    props: { backgroundColor: "default", textColor: "default" },
    content: [text("Safety is a habit, not a rule.")],
    children: [],
  },
];

export const leadershipLesson = [
  heading(2, "Your first week as a manager"),
  paragraph(text("Meet each person on your team one to one.")),
];

export const extinguisherNotes = [
  heading(2, "What to remember"),
  bullet("Pull the pin, aim at the base of the fire, squeeze, sweep."),
  bullet("Keep your back to an exit."),
  callout("warning", "Never fight a fire that is spreading: leave and raise the alarm."),
];
