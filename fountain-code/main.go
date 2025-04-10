package main

import (
	"bytes"
	"fmt"
	"io"
	"unsafe"

	"github.com/yimiaoxiehou/ltcodes/lt"
)

// 全局LT编码器实例，用于WASM模块
var (
	encoder    *lt.BlockEncoder
	blockBytes []byte
)

func main() {}

// bytesReader 从内存指针创建字节读取器
// ptr: WASM内存指针
// length: 数据长度
func bytesReader(ptr *byte, length int) io.Reader {
	slice := unsafe.Slice(ptr, length) // 将指针转换为Go切片
	return &byteSliceReader{data: slice}
}

// byteSliceReader 实现io.Reader接口的内存读取器
type byteSliceReader struct {
	data []byte // 数据缓冲区
	pos  int    // 当前读取位置
}

// Read 实现io.Reader接口
func (r *byteSliceReader) Read(p []byte) (n int, err error) {
	if r.pos >= len(r.data) {
		return 0, io.EOF // 数据读取完毕
	}
	n = copy(p, r.data[r.pos:]) // 复制数据到目标缓冲区
	r.pos += n                  // 移动读取位置
	return n, nil
}

// initEncode 初始化LT编码器(WASM导出函数)
// ptr: WASM内存中的文件数据指针
// length: 文件数据长度
// blockSize: 编码块大小(字节)
// initSeed: 随机数种子
//
//export initEncode
func initEncode(ptr *byte, length int, blockSize int, initSeed int) {
	reader := bytesReader(ptr, length)
	// 创建新的LT编码器实例
	encoder = lt.NewEncoder(reader, uint64(length), uint32(blockSize), uint32(initSeed))
}

// getNextBlock 获取下一个编码块(WASM导出函数)
// 返回: 编码块数据的指针和长度
//
//export getNextBlock
func getNextBlock() int {
	bs := encoder.NextCodedBlock().Pack()
	// blockBytes, _ = qrcode.Encode(string(bs), qrcode.Medium, 600)
	blockBytes = bs
	return len(blockBytes)
}

// export getNextBlockPtr 获取下一个编码块的指针(WASM导出函数)
// 返回: 编码块数据的指针
//
//export getNextBlockPtr
func getNextBlockPtr() *byte {
	return &blockBytes[0]
}

// allocate 在WASM内存中分配空间(WASM导出函数)
// size: 需要分配的内存大小(字节)
// 返回: 分配内存的指针
//
//export allocate
func allocate(size int) *byte {
	buffer := make([]byte, size)
	return &buffer[0] // 返回切片首元素指针
}

var (
	decoder *lt.BlockDecoder
	ctrs    struct {
		in   int
		proc int
		drop int
	}
	fileData []byte
)

// initDecode 初始化LT解码器(WASM导出函数)
//
//export initDecode
func initDecode() {
	decoder = new(lt.BlockDecoder)
	ctrs = struct {
		in, proc, drop int
	}{}
}

// decodeNext 解码下一个块(WASM导出函数)
// data: 待解码的块数据
//
//export decodeNext
func decodeNext(ptr *byte, length int) int {
	if ptr == nil || length <= 0 {
		fmt.Println("Error: Null or empty data received")
		return 0
	}

	// Create slice from pointer and length
	data := unsafe.Slice(ptr, length)
	fmt.Println(len(data))
	b, err := lt.ReadBlockFrom(bytes.NewReader(data))
	ctrs.in++
	if err != nil {
		fmt.Errorf(err.Error())
		ctrs.drop++
		// return
	} else if !decoder.Validate(b) {
		//			Eprintln("Dropped block found")
		ctrs.drop++
	} else {
		ctrs.proc++
		decoder.Include(b)
	}

	if done, data := decoder.AttemptDone(); done {
		fileData = data
		return len(data)
	}
	return 0
}

// getFileData 获取解码后的文件数据(WASM导出函数)
//
//export getDecodedFilePtr
func getDecodedFilePtr() *byte {
	return &fileData[0]
}
