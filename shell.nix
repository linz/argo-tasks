let
  pkgs = import (
    builtins.fetchTarball {
      url = "https://github.com/nixos/nixpkgs/archive/57610d2f8f0937f39dbd72251e9614b1561942d8.tar.gz";
      sha256 = "0k8az8vmfdk1n8xlza252sqk0hm1hfc7g67adin6jxqaab2s34n9";
    }
  ) {};
  nodejs = pkgs.nodejs_22;
in
  pkgs.mkShell {
    packages = [
      pkgs.bashInteractive
      nodejs
    ];
    shellHook = ''
      ln --force --no-target-directory --symbolic "${nodejs}/bin/node" node
    '';
  }
