/********************************************************************************
 *   Ledger Node JS API
 *   (c) 2017-2018 Ledger
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 ********************************************************************************/
import base32 from "base32.js";
import { sha256 } from "sha.js";
// TODO use bip32-path library
export function splitPath(path: string): number[] {
  const result: number[] = [];
  const components = path.split("/");
  components.forEach((element) => {
    let number = parseInt(element, 10);
    if (isNaN(number)) {
      return; // FIXME shouldn't it throws instead?
    }
    if (element.length > 1 && element[element.length - 1] === "'") {
      number += 0x80000000;
    }
    result.push(number);
  });
  return result;
}

export function hexBuffer(str: string): Buffer {
  return Buffer.from(str.startsWith("0x") ? str.slice(2) : str, "hex");
}

export function maybeHexBuffer(
    str: string | null | undefined
): Buffer | null | undefined {
  if (!str) return null;
  return hexBuffer(str);
}

/**
 * @ignore for the README
 *
 * Helper to convert an integer as a hexadecimal string with the right amount of digits
 * to respect the number of bytes given as parameter
 *
 * @param int Integer
 * @param bytes Number of bytes it should be represented as (1 byte = 2 caraters)
 * @returns The given integer as an hexa string padded with the right number of 0
 */
export const intAsHexBytes = (int: number, bytes: number): string =>
    int.toString(16).padStart(2 * bytes, "0");

export function foreach<T, A>(
  arr: T[],
  callback: (arg0: T, arg1: number) => Promise<A>
): Promise<A[]> {
  function iterate(index, array, result) {
    if (index >= array.length) {
      return result;
    } else {
      return callback(array[index], index).then(function (res) {
        result.push(res);
        return iterate(index + 1, array, result);
      });
    }
  }

  return Promise.resolve().then(() => iterate(0, arr, []));
}

export function hash(data: Buffer) {
  const hasher = new sha256();
  hasher.update(data, "utf8");
  return hasher.digest();
}

