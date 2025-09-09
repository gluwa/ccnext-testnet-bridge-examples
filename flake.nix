{
  description = "Project dependencies for the cc3-next test bridge example";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/release-25.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = {
    self,
    nixpkgs,
    flake-utils,
  }:
    flake-utils.lib.eachDefaultSystem (system: let
      pkgs = import nixpkgs {
        inherit system;
      };
    in {
      devShells.default = pkgs.mkShell {
        # Packages used for development
        packages = with pkgs; [
          foundry
          yarn
          nodejs
        ];

        shellHook = ''
          # See https://nixos.wiki/wiki/Node.js
          export NPM_GLOBAL_PREFIX="$PWD/npm-global"
          export NODE_PATH="$NPM_GLOBAL_PREFIX/lib/node_modules";
          export PATH="$NPM_GLOBAL_PREFIX/bin:$PATH"
          npm config set prefix "$NPM_GLOBAL_PREFIX"

        '';
      };
    });
}
