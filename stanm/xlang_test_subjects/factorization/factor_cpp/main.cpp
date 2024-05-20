#include <iostream>

#include "factor.h"

using namespace std;

const char USAGE[] = "\
Usage: [program_name] <number>\n\
    Performs integer factorization on the provided <number> and prints the\n\
    result as space-separated values. Each prime factor is listed once, and\n\
    if a factor divides the number more than once, its occurrences are enclosed\n\
    in parentheses. For example, 2(3) denotes the number being divisible by 2\n\
    three times.\n\
";

const char INVALID_NUMBER[] =
    "The given number could not be parsed or is zero.";

int main(int argc, char *argv[]) {
    if (argc != 2) {
        cout << USAGE << endl;
        return 1;
    }

    long number = strtol(argv[1], nullptr, 0);
    if (number == 0L) {
        cout << INVALID_NUMBER << endl;
        return 2;
    }

    print_factors(number);

    return 0;
}
