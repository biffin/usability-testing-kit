# Projects

Each usability study lives in its own self-contained folder here, named after the
site you're testing (e.g. `stripe/`, `acme/`).

You don't create these by hand — Claude does. Open this kit in Claude Code and say:

> generate for https://www.example.com

Claude will create `projects/example/` with everything inside it:

```
projects/example/
├── project.md        ← metadata: URL, date, goal, status
├── personas/         ← the buyers Claude generated
├── tasks/            ← the tasks they'll attempt
├── sessions/         ← transcripts + screenshots, per persona / per task
├── findings.md       ← the synthesized report
└── eval-report.md    ← automated quality checks
```

See the top-level `README.md` for the full workflow.
