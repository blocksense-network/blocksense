Subject program for comparison of the debugging experience from different
toolchains. Related to task
https://coda.io/d/_d6vM0kjfQP6#Task-DB_tuk5j/r698&view=modal .

To run C++ code: just compile and run normally, e.g. `g++ factor.cpp &&
./a.out`.

To run the Noir code:

1. cd into the directory containing Nargo.toml
2. `nargo check` generates and populates Prover.toml, if it's necessary
3. `nargo prove` "runs the program"
4. `nargo verify` verifies the run performed by `nargo prove`
5. `nargo execute` also runs the program but in VM...

For this program, `nargo execute` is 4x faster in real time (12 sec vs 4 sec)
and 25 times faster in "user time" (accounting for parallel execution; 5 sec vs
125 sec).
