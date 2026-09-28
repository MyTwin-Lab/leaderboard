import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import type { Task } from "../database-service/domain/entities.js";
import { PlatformRegistry } from "../registry/platform.js";
import { boardProgress, copyBoardTemplate, isBoardDone, usesBoard, type BoardDeps } from "./board.js";

const descriptor = (key: string) => ({ key, label: key, longLabel: key, icon: key, briefRequired: false, publiclyVisible: false });

function task(over: Partial<Task>): Task {
  return { uuid: "t", challenge_id: "c-1", user_id: null, title: "Task", status: "todo", created_at: new Date(), ...over } as Task;
}

function makeTaskRepo(template: Task[] = [], personal: Task[] = []) {
  let next = 0;
  return {
    findTemplateTasks: vi.fn(async () => template),
    findPersonalTasks: vi.fn(async () => personal),
    create: vi.fn(async (data: any) => ({ uuid: `copy-${++next}`, ...data })),
  } satisfies BoardDeps["taskRepo"] | Record<string, unknown>;
}

describe("usesBoard", () => {
  beforeEach(() => {
    PlatformRegistry.reset();
    PlatformRegistry.install({
      flows: [{ descriptor: descriptor("with-board"), uses: { board: true } }, { descriptor: descriptor("plain") }],
    });
  });

  afterAll(() => {
    PlatformRegistry.reset();
  });

  it("reads the flow's declaration", () => {
    expect(usesBoard("with-board")).toBe(true);
    expect(usesBoard("plain")).toBe(false);
    expect(usesBoard(null)).toBe(false);
  });
});

describe("copyBoardTemplate", () => {
  it("copies parents first, then children attached to the copy of their parent", async () => {
    const taskRepo = makeTaskRepo([
      task({ uuid: "t3", parent_task_id: "t1", title: "Child of 1", description: "d3" }),
      task({ uuid: "t1", title: "Parent 1", description: "d1" }),
      task({ uuid: "t2", title: "Parent 2", description: "d2" }),
    ]);

    const created = await copyBoardTemplate("c-1", "alice", { taskRepo: taskRepo as any });

    expect(created).toBe(3);
    const copies = taskRepo.create.mock.calls.map(([data]) => data);
    expect(copies[0]).toEqual({ challenge_id: "c-1", user_id: "alice", title: "Parent 1", description: "d1", status: "todo" });
    expect(copies[1]).toMatchObject({ title: "Parent 2", user_id: "alice" });
    expect(copies[2]).toMatchObject({ title: "Child of 1", parent_task_id: "copy-1", status: "todo" });
  });

  it("creates nothing for an empty template", async () => {
    const taskRepo = makeTaskRepo();

    expect(await copyBoardTemplate("c-1", "alice", { taskRepo: taskRepo as any })).toBe(0);
    expect(taskRepo.create).not.toHaveBeenCalled();
  });
});

describe("boardProgress", () => {
  it("counts the owner's tasks and the done ones", async () => {
    const taskRepo = makeTaskRepo([], [task({ status: "done" }), task({ status: "todo" }), task({ status: "done" })]);

    expect(await boardProgress("c-1", "alice", { taskRepo: taskRepo as any })).toEqual({ total: 3, done: 2 });
    expect(taskRepo.findPersonalTasks).toHaveBeenCalledWith("c-1", "alice");
  });
});

describe("isBoardDone", () => {
  it("needs at least one task, all of them done", () => {
    expect(isBoardDone({ total: 2, done: 2 })).toBe(true);
    expect(isBoardDone({ total: 2, done: 1 })).toBe(false);
    expect(isBoardDone({ total: 0, done: 0 })).toBe(false);
  });
});
