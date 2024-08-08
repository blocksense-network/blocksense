To run, make sure you have a Google Maps API key in ~/.local/share/google-api/key.

You should have the Static Maps API enabled for it, as well as the Geolocation API.

Once that's done, run this in a dedicated shell, to have the map view update on
changes to .nix files:

```
nix-shell -p entr findutils bash --run \                                                                                                            7.9m  14:55:39 2024-08-08 (Thu)
    "ls *.nix | \
     entr -rs ' \
     nix-build eval.nix -A config.scripts.output --no-out-link \
     | xargs printf -- \"%s/bin/map\" \
     | xargs bash \
     ' \
    "
```

This tutorial demonstrates the use of Nix modules. The default.nix file
includes marker.nix file includes the path.nix file. They build on top of each
other to produce the final app.

For more information, see this:
https://nix.dev/tutorials/module-system/deep-dive#the-submodule-type .
