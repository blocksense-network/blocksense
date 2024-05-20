#include <cstdlib>
#include <iostream>
#include <vector>

using namespace std;

// Prints a single factor of the input number, given whether the factor is the
// first factor to be printed or not and the number of times it evenly divides
// the input number (zero or more). If `count` > 0 and `factor_is_first` is set
// to true, then `factor_is_first` is set to false which has effect outside of
// this function.
//
// Helper function for `print_factors`.
void print_factor(long factor, bool &factor_is_first, int count) {
    if (count > 0) {
        if (!factor_is_first) {
            cout << ' ';
        }

        cout << factor;

        if (count > 1) {
            cout << "(" << count << ")";
        }

        if (factor_is_first) {
            factor_is_first = false;
        }
    }
}

// Prints all the positive prime factors of the given number. If the number is
// negative, prints -1 first.
void print_factors(long number) {
    bool factor_is_first = true;
    if (number < 0) {
        number *= -1;
        cout << -1;
        factor_is_first = false;
    }

    vector<long> primes;

    for (long factor = 2; factor * factor <= number; ++factor) {
        bool factor_is_prime = true;

        for (long p : primes) {
            if (factor % p == 0) {
                factor_is_prime = false;
                break;
            }

            if (p * p > factor) {
                break;
            }
        }

        if (factor_is_prime) {
            primes.push_back(factor);

            int count = 0;
            for (; number % factor == 0; number /= factor)
                ++count;

            print_factor(factor, factor_is_first, count);
        }
    }

    if (number > 1) {
        print_factor(number, factor_is_first, 1);
    }

    cout << endl;
}
