# Contributing to Blocksense

Welcome and thank you for your interest in contributing to Blocksense! We appreciate your support.

Reading and following these guidelines will help us make the contribution process easy and effective for everyone involved.

## Report a bug

1. Check on the [GitHub issue tracker](https://github.com/blocksense-network/blocksense/issues) if your bug was already reported.

2. If you were not able to find the bug or feature [open a new issue](https://github.com/blocksense-network/blocksense/issues/new)

3. Once submitted, do not expect issues to be picked up or solved right away.
   The only way to ensure this, is to [work on the issue yourself](#making-changes-to-blocksense).

## Report a security vulnerability

Please see our [security policy](/.github/SECURITY.md).

## Making changes to Blocksense

1. Search for related issues that cover what you're going to work on.
   It could help to mention there that you will work on the issue.

   We strongly recommend first-time contributors not to propose new features but rather fix tightly-scoped problems in order to build trust and a working relationship with maintainers.

   Issues labeled [good first issue](https://github.com/blocksense-network/blocksense/labels/good%20first%20issue) should be relatively easy to fix and are likely to get merged quickly.
   Pull requests addressing issues labeled [idea approved](https://github.com/blocksense-network/blocksense/labels/idea%20approved) are especially welcomed by maintainers and will receive prioritized review.

   If there is no relevant issue yet and you're not sure whether your change is likely to be accepted, [open an issue](https://github.com/blocksense-network/blocksense/issues/new) yourself.

2. Check for [pull requests](https://github.com/blocksense-network/blocksense/pulls) that might already cover the contribution you are about to make.
   There are many open pull requests that might already do what you intend to work on.
   You can use [labels](https://github.com/blocksense-network/blocksense/labels) to filter for relevant topics.

3. Make your change!

   3.1 [Setup a dev environment](./SETUP.md) <br>
   3.2 Read our GitHub style guide - [Branch Naming & Commit Guidelines](#-branch-naming--commit-guidelines) <br>
   3.3 Implement your changes <br>
   3.4 Confirm that everything works by running tests and local simulations <br>

4. If the current tests don't cover your changes, add new ones!

5. [Create a pull request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request) for your changes.

   - Clearly explain the problem that you're solving.

     Link related issues to inform interested parties and future contributors about your change.
     If your pull request closes one or multiple issues, mention that in the description using `Closes: #<number>`, as it will then happen automatically when your change is merged.

   - Credit original authors when you're reusing or building on their work.
   - Link to relevant changes in other projects, so that others can understand the full context of the change in the future when you or someone else will change or troubleshoot the code.
     This is especially important when your change is based on work done in other repositories.

     Example:

     ```
     This is based on the work of @user in <url>.
     This solution took inspiration from <url>.

     Co-authored-by: User Name <user@example.com>
     ```

     When cherry-picking from a different repository, use the `-x` flag, and then amend the commits to turn the hashes into URLs.

   - Make sure to have [a clean history of commits on your branch by using rebase](https://www.digitalocean.com/community/tutorials/how-to-rebase-and-update-a-pull-request).
   - [Mark the pull request as draft](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/changing-the-stage-of-a-pull-request) if you're not done with the changes.

6. Do not expect your pull request to be reviewed immediately.

   Following this checklist will make the process smoother for everyone:

   - [ ] Fixes an [idea approved](https://github.com/blocksense-network/blocksense/labels/idea%20approved) issue
   - [ ] Add new tests if necessary and make sure all existing pass
   - [ ] Update relevant documentation/readme files
   - [ ] Code and comments are self-explanatory
   - [ ] Commit message explains **why** the change was made

7. If you need additional feedback or help to getting pull request into shape, ask other contributors using [@mentions](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#mentioning-people-and-teams).

## 🌿 Branch Naming & Commit Guidelines

### 🔹 Branch Naming Convention

- Use **hyphens** to separate words.
- Prefix branches with a **type**:
  `feature/`, `fix/`, `docs/`, `style/`, `refactor/`, `test/`, `chore/`.
- Followed by a **brief description**.

#### 📌 Example:

**Documentation Website Branch Naming**

- docs.ws/feat/<some-short-description>
- docs.ws/fix/<some-short-description>
- docs.ws/docs/<some-short-description>
- docs.ws/style/<some-short-description>
- docs.ws/refactor/<some-short-description>
- docs.ws/test/<some-short-description>
- docs.ws/chore/<some-short-description>

**Explorer Website Branch Naming**

- explorer.ws/feat/<some-short-description>
- explorer.ws/fix/<some-short-description>
- explorer.ws/docs/<some-short-description>
- explorer.ws/style/<some-short-description>
- explorer.ws/refactor/<some-short-description>
- explorer.ws/test/<some-short-description>
- explorer.ws/chore/<some-short-description>

---

### 💾 Formatting & Saving Code Before Commit

Before committing, **format your code** using:

**yarn format:write**

---

### ✨ Commit Messages

```
<type><scope>: <subject>

[optional body]

[optional footer(s)]
```

- Use **present tense** (_"Add feature"_ not _"Added feature"_).
- Use **imperative** mood
- **NOT** end with a .
- **Capitalize** the first letter of the message.
- Keep messages **concise but descriptive**.
- Reference **issues and pull requests** when applicable.
- **Follow this structure**:
  **type(scope): subject**
  - **Type:** feat, fix, docs, style, refactor, perf, ci, build, update, config, chore, test
  - **Scope:** The part of the project the change affects _(optional)_
  - **Subject:** A brief description of the change
- **Body** is a long form explanation of the change. It should answer the following questions:

  - Why have I made these changes? / Why the change was needed?
  - What you did, what effect have my changes made?
    - Bad example: Change `div` class `a` to `b`
    - Better example: Fix “description” and “about us” paragraphs from overlapping on mobile devices
  - (optional) How you solved the problem? For most changes, it is obvious
  - What are the changes in reference to?

- **Footers**
  - Must be parse-able by git interpret-trailers
  - BREAKING CHANGE: - needed for commits

#### Commit Types

- feat (_feature_) - Add new user-facing functionality or update a public API.
  - If the commit changes a library (and so its users are developers, not actual end-users), feat relates to its public API
  - Similarly, for backend services, changes to the REST/GraphQL/RPC/etc. API should be marked as feat
  - A repository which is a collection of packages (e.g. ethereum.nix), adding a new package
- fix (_bug fix_) - Resolve a bug in existing functionality.
- docs (_documentation_) - Modify or add documentation.
- style (_code style_) – Reformat code, update comments, or make stylistic changes that do not affect behavior.
- refactor (_refactoring_) – Improve code structure without changing functionality.
- perf (_performance_) – Optimize performance or efficiency.
- ci (_continuous integration_) – Modify CI/CD pipeline configurations or workflows.
- build (_build system_) – Modify build scripts, dependencies, or package configurations.
- update (_dependency update_) – Update the version of a dependency.
- config (_configuration_) – Modify system or application configuration settings.
- chore (_maintenance_) – Miscellaneous tasks that do not fit other types, such as renaming files or minor internal changes.
- test (_testing_) – Add or update tests, but not changing implementation.

#### 📌 Example:

**Documentation Website Specific Commits**

- feat(docs.ws): <some-short-description>
- fix(docs.ws): <some-short-description>
- docs(docs.ws): <some-short-description>
- style(docs.ws): <some-short-description>
- refactor(docs.ws): <some-short-description>
- test(docs.ws): <some-short-description>
- chore(docs.ws): <some-short-description>
- build(docs.ws): <some-short-description>
- config(docs.ws): <some-short-description>

**Explorer Website Specific Commits**

- feat(explorer.ws): <some-short-description>
- fix(explorer.ws): <some-short-description>
- docs(explorer.ws): <some-short-description>
- style(explorer.ws): <some-short-description>
- refactor(explorer.ws): <some-short-description>
- test(explorer.ws): <some-short-description>
- chore(explorer.ws): <some-short-description>
- build(explorer.ws): <some-short-description>
- config(explorer.ws): <some-short-description>

**Common Updates in the Blocksense Docs Theme Folder**

- feat(docs.theme): <some-short-description>

---

✅ **Following these conventions ensures better collaboration, cleaner history, and easier code reviews.** 🚀

## Getting help

Whenever you're stuck or do not know how to proceed, you can always ask for help.
We invite you to use our [public Discord](https://discord.com/invite/blocksense) to ask questions.

## [Git Tips & Tricks](./GITTIPS.md)
