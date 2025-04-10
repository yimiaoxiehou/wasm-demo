

### pre
install tinygo and golang 

### run wasm demo
```bash
tinygo build -target wasm  -o demo/main.wasm demo/main.go  
go run server.go -dir public
```

### build fountain-code wasm 
```bash
tinygo build -target wasm  -o fountain-code/main.wasm fountain-code/main.go  
go run server.go -dir fountain-code
```

