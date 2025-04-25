# 🛠 Git Tips & Tricks

Managing code in a dynamic project like **Blocksense** requires efficient use of version control. **Git**, the distributed version control system, is a fundamental tool for developers working on collaborative projects.

This guide provides essential **Git tips and tricks** to streamline your workflow and enhance productivity within the Blocksense project.

---

## 🔄 Sync Branches with Their Upstream Versions

### 📌 Sync the Main Branch

All changes introduced to `main` should come from a **Pull Request (PR)**.
We use the **rebase and merge** strategy, ensuring fast-forward merges, keeping the **main branch** always ahead of your local `main`, maintaining a **linear and clean history**.

#### **Steps to Sync Your Local `main` Branch:**

1️⃣ **Check out `main` branch:**

```
git checkout main
```

2️⃣ **Pull the changes from the upstream `main` branch:**

```
git pull origin main
```

---

### 📌 Sync Feature Branches

#### **Completely Resetting the Branch**

When you need to **sync your feature branch** with its upstream version, especially while collaborating with team members, follow these steps:

1️⃣ **Check out your feature branch:**

```
git checkout feature-branch-name
```

2️⃣ **Fetch changes from upstream:**

```
git fetch origin
```

3️⃣ **Reset the local branch to the upstream version:**

```
git reset --hard @{u}
```

✅ Now your **local feature branch is in sync** with the upstream version.

⚠️ **Warning:** This will **overwrite** your current branch version, so ensure that you do not have any uncommitted local changes before running this command.

If your feature branch was already pushed remotely, you may need to **force push** after reset:

```
git push --force-with-lease
```

🔹 `--force-with-lease` ensures that you do not overwrite any changes pushed by other team members.

---

## 🔄 Integrating Upstream Changes Without Resetting the Branch

If you **do not want to completely reset your branch**, you can **rebase** to integrate the latest upstream changes while preserving local commits.

#### **Steps to Rebase Without Resetting:**

1️⃣ **Check out the feature branch:**

```
git checkout feature-branch-name
```

2️⃣ **Fetch the latest changes from the upstream repository:**

```
git fetch origin
```

3️⃣ **Rebase your local changes onto the latest upstream version:**

```
git rebase origin/feature-branch-name
```

✅ This will **reapply your local commits** on top of the latest changes from the upstream branch.

If conflicts arise during the rebase:

4️⃣ **Continue after resolving conflicts:**

```
git rebase --continue
```

5️⃣ **Abort rebase if needed:**

```
git rebase --abort
```

After rebase, **force push** your branch to update the remote repository:

```
git push --force-with-lease
```

---

## 🔀 Interactive Rebase

**Interactive rebase** allows you to **modify commit history**, combine, reorder, or edit commits for a cleaner commit log.

#### **Start an Interactive Rebase:**

1️⃣ **Check out the feature branch:**

```
git checkout feature-branch-name
```

2️⃣ **Start interactive rebase:**

```
git rebase -i main
```

This will open an interactive editor where you can choose **rebase options**:

- `pick` - Use the commit as is.
- `reword` - Edit the commit message.
- `squash` - Combine this commit with the previous one, merging messages.
- `fixup` - Combine this commit with the previous one, discarding the message.
- `drop` - Remove this commit.

#### **Finalizing the Rebase:**

1️⃣ **Save and exit VIM:**

- Press `Esc`, then type `:x` and hit `Enter`.
  2️⃣ **If conflicts occur, resolve them and continue:**

```
git add resolved-file
git rebase --continue
```

3️⃣ **Abort the rebase if necessary:**

```
git rebase --abort
```

🔹 After rebasing, **force push the changes**:

```
git push --force-with-lease
```

---

## 🤝 Adding a Co-Author to a Commit

When you want to credit another developer for their contribution to a commit, **Git allows you to add a co-author**.

### **Adding a Co-Author to a New Commit**

1️⃣ **Stage your changes:**

```
git add <file(s)>
```

2️⃣ **Commit with a co-author:**

```
git commit -m "Your commit message

Co-authored-by: Name <email@example.com>"
```

✅ **Example:**

```
git commit -m "Add new feature to the project

Co-authored-by: Alice Smith <alice@example.com>
Co-authored-by: Bob Johnson <bob@example.com>"
```

🔹 The **Co-authored-by** line must be **separated by an empty line**.

---

### **Adding a Co-Author to an Existing Commit**

If you've **already committed** but want to add a co-author, you can **amend the commit**:

1️⃣ **Amend the last commit:**

```
git commit --amend
```

2️⃣ **Edit the commit message to include the co-author:**

```
Co-authored-by: Alice Smith <alice@example.com>
```

3️⃣ **Save and exit VIM, then force push if needed:**

```
git push --force-with-lease
```

⚠️ **Force pushing should be done cautiously**, especially on shared branches.

---

## 🔹 Additional Notes

### **Fast-Forward Merge**

A **fast-forward merge** occurs when a branch has a **linear path to the target branch**.
In this case, **Git simply moves the HEAD pointer forward** to the latest commit on the branch being merged.

🔹 **This keeps history clean without creating a merge commit.**

---

✅ **Following these Git best practices will help maintain a clean commit history and ensure smooth collaboration in the Blocksense project.** 🚀
