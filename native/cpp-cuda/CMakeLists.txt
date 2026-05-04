cmake_minimum_required(VERSION 3.18)
project(adaptivenet-cpp-cuda LANGUAGES CXX CUDA)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CUDA_STANDARD 17)
set(CMAKE_CUDA_STANDARD_REQUIRED ON)

# Default to Turing (sm_75 — covers GTX 1660 / RTX 20-series); override via
#   cmake -DCMAKE_CUDA_ARCHITECTURES=86 ..
if(NOT CMAKE_CUDA_ARCHITECTURES)
  set(CMAKE_CUDA_ARCHITECTURES 75)
endif()

if(NOT CMAKE_BUILD_TYPE)
  set(CMAKE_BUILD_TYPE Release)
endif()

add_executable(ising src/main.cu)

target_compile_options(ising PRIVATE
  $<$<COMPILE_LANGUAGE:CUDA>:-O3 --use_fast_math>
  $<$<COMPILE_LANGUAGE:CXX>:-O3 -Wall -Wextra>
)
