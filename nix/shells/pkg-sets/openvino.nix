{pkgs, ...}: {
  packages = with pkgs; [
    openvino
  ];

  env.OPENVINO_INSTALL_DIR = "${pkgs.openvino}";
}
