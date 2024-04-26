{...}: {
  pre-commit.hooks = {
    alejandra.enable = true;
    editorconfig-checker.enable = true;
    cargo-check.enable = true;
    rustfmt.enable = true;
    prettier.enable = true;
  };
}
