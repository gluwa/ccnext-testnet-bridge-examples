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
    flake-utils.eachDefaultSystem (system: let
      pkgs = import nixpkgs;
    in {
      devShells.default = pkgs.mkShell {
        # Packages used for development
        packages = with pkgs; [
          foundry
          yarn
        ];
      };
    });
}
