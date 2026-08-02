cmake_minimum_required(VERSION 3.21)

project(taihang_pso_adapter LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

get_filename_component(
  TAIHANG_PROTOCOLS_DIR
  "${CMAKE_CURRENT_SOURCE_DIR}/../taihang-protocols"
  ABSOLUTE
)
set(
  TAIHANG_PROTOCOLS_BUILD_DIR
  "${TAIHANG_PROTOCOLS_DIR}/build"
  CACHE PATH
  "Existing taihang-protocols build directory"
)
get_filename_component(
  TAIHANG_CORE_DIR
  "${TAIHANG_PROTOCOLS_DIR}/../taihang"
  ABSOLUTE
)

set(TAIHANG_PROTOCOLS_LIBRARY "${TAIHANG_PROTOCOLS_BUILD_DIR}/libtaihang_protocols.a")
set(TAIHANG_CORE_LIBRARY "${TAIHANG_PROTOCOLS_BUILD_DIR}/taihang_core_build/libtaihang.a")

foreach(required_path
    "${TAIHANG_PROTOCOLS_DIR}/include/taihang/mpc/pso/mqrpmt_pso.hpp"
    "${TAIHANG_CORE_DIR}/include/taihang/net/net_io.hpp"
    "${TAIHANG_PROTOCOLS_LIBRARY}"
    "${TAIHANG_CORE_LIBRARY}")
  if(NOT EXISTS "${required_path}")
    message(FATAL_ERROR "Required Taihang file was not found: ${required_path}")
  endif()
endforeach()

find_package(OpenMP REQUIRED)
find_package(OpenSSL REQUIRED)
find_package(Threads REQUIRED)
find_package(xxHash REQUIRED CONFIG)

add_executable(taihang_pso_adapter main.cpp)

target_include_directories(taihang_pso_adapter PRIVATE
  "${TAIHANG_PROTOCOLS_DIR}/include"
  "${TAIHANG_CORE_DIR}/include"
  "${TAIHANG_CORE_DIR}/third_party/robin_hood"
)

target_compile_options(taihang_pso_adapter PRIVATE
  -O3
  -Wall
  -Wextra
  -Wpedantic
  -Wno-deprecated-declarations
  -maes
  -msse4.1
  -mpclmul
  -mavx
  -mavx2
  -mrdseed
)

target_link_libraries(taihang_pso_adapter PRIVATE
  "${TAIHANG_PROTOCOLS_LIBRARY}"
  "${TAIHANG_CORE_LIBRARY}"
  OpenSSL::Crypto
  xxHash::xxhash
  OpenMP::OpenMP_CXX
  Threads::Threads
  ${CMAKE_DL_LIBS}
)
