# Delegation task mismatch

## Resolved active task

`python3 ./.trellis/scripts/task.py current --source` returned:

- Task: `.trellis/tasks/07-27-i18n-bundled-python-pr3`
- Source: `session:claude_f7ca65de-dbf9-4d8c-83f7-5b0c1c6efca4`

## Delegated target

The delegation prompt names `.trellis/tasks/07-27-i18n-common-skills-pr2` as the active task and asks for PR2 planning artifacts.

## Blocking constraints

The Research Agent contract requires resolving the active task through `task.py current --source`, persisting findings only under that task's `research/` directory, and not editing task planning files outside research artifacts. Therefore this agent cannot safely write PR2's `prd.md`, `design.md`, `implement.md`, `implement.jsonl`, or `check.jsonl` while the resolved active task is PR3.

## Required caller action

Re-dispatch with the session active-task pointer set to `.trellis/tasks/07-27-i18n-common-skills-pr2`, or delegate the planning-file edits to a planning agent whose write scope includes task artifacts. Do not start the PR2 task.
