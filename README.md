# HexGL: 3D Racing

Futuristic HTML5 / WebGL time-attack racing — maintained and updated for [Arcadizu](https://arcadizu.com).

**Play:** [arcadizu.com/g/hexgl-3d-racing](https://arcadizu.com/g/hexgl-3d-racing)

## Credits

This project is based on the original **[HexGL](https://github.com/BKcore/HexGL)** by [Thibaut Despoulain (BKcore)](http://bkcore.com).

We did not create HexGL from scratch. We fork and improve it — UI polish, iframe / portal readiness, bugfixes, and occasional updates — while keeping credit with the original author.

- Original source: [github.com/BKcore/HexGL](https://github.com/BKcore/HexGL)
- Original demo (author): [hexgl.bkcore.com](http://hexgl.bkcore.com)

## License

Unless noted otherwise in a file, code and resources follow the original project’s **MIT** license. Audio assets may use additional Creative Commons terms as in the upstream project — check the original repo for details.

## Run locally

```bash
cd HexGL
python3 -m http.server 8080
# open http://127.0.0.1:8080/
```

For full-size textures, swap the `textures/` and `textures.full/` directories if present.

## Portal build

A zip suitable for Arcadizu admin upload lives at `build/hexgl-3d-racing.zip` after you generate it (or use the one in `build/` if present). Entry file must be `index.html` at the zip root.
