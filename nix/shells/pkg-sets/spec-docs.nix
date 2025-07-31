{ inputs', ... }:
{
  packages = [
    inputs'.quartz-nix.packages.quartz-cli
  ];

  enterShell = ''
    echo "📚 Blocksense Documentation Environment"
    echo "======================================"
    echo ""
    echo "Available tools:"
    echo "  quartz create    - Initialize a new Quartz site"
    echo "  quartz build     - Build the specification website"
    echo "  quartz sync      - Sync content with remote"
    echo ""
    echo "Specification content is in: ./spec/"
    echo "To build the website: nix build .#specification-website"
    echo ""
  '';
}
