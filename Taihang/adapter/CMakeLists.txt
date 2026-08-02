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
set(OPENSSL_USE_STATIC_LIBS TRUE)
find_package(OpenSSL REQUIRED)
find_package(Threads REQUIRED)
find_package(xxHash REQUIRED CONFIG)

if(DEFINED OPENSSL_ROOT_DIR)
  file(REAL_PATH "${OPENSSL_ROOT_DIR}" EXPECTED_OPENSSL_ROOT)
  file(REAL_PATH "${OPENSSL_CRYPTO_LIBRARY}" RESOLVED_OPENSSL_CRYPTO_LIBRARY)
  string(FIND
    "${RESOLVED_OPENSSL_CRYPTO_LIBRARY}"
    "${EXPECTED_OPENSSL_ROOT}/"
    OPENSSL_ROOT_POSITION
  )
  if(NOT OPENSSL_ROOT_POSITION EQUAL 0)
    message(FATAL_ERROR
      "The Taihang adapter must use the patched OpenSSL library under "
      "${EXPECTED_OPENSSL_ROOT}, but CMake selected "
      "${RESOLVED_OPENSSL_CRYPTO_LIBRARY}"
    )
  endif()
endif()

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
