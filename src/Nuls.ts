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
import type Transport from "@ledgerhq/hw-transport";
import {
  splitPath,
  foreach,
} from "./utils";
const CLA = 0xe0;
const INS_GET_CONF = 0x04;
const INS_GET_PK = 0x05;
const INS_SIGN_TX = 0x06;
const INS_SIGN_MESSAGE = 0x07;

const APDU_MAX_SIZE = 150;
const P2_LAST_APDU = 0x80;
const P2_MORE_APDU = 0x00;
const SW_OK = 0x9000;
const SW_CANCEL = 0x6985;
const SW_UNKNOWN_OP = 0x6c24;
const SW_MULTI_OP = 0x6c25;
const SW_NOT_ALLOWED = 0x6c66;
const SW_UNSUPPORTED = 0x6d00;
const SW_BLIND_SIGN = 0xB009;
const SW_KEEP_ALIVE = 0x6e02;
const TX_MAX_SIZE = 30000;

/**
 * Nuls API
 *
 * @example
 * import Nuls from "@ledgerhq/hw-app-nuls";
 * const nuls = new Nuls(transport)
 */

export default class Nuls {
  transport: Transport;

  constructor(transport: Transport, scrambleKey = "nuls0nuls") {
    this.transport = transport;
    transport.decorateAppAPIMethods(
      this,
      ["getAppConfiguration", "getPublicKey", "signTransaction", "signMessage"],
      scrambleKey
    );
  }

  getAppConfiguration(): Promise<{
    version: string;
  }> {
    return this.transport
      .send(CLA, INS_GET_CONF, 0x00, 0x00)
      .then((response) => {
        const version =
          "" + response[1] + "." + response[2] + "." + response[3];
        return {
          version: version,
        };
      });
  }

  /**
   * get Nuls address for a given BIP 32 path.
   * @param path a path in BIP 32 format
   * @option boolDisplay optionally enable or not the display
   * @return an object with a publicKey, address
   * @example
   * nuls.getPublicKey("44'/60'/0'/0/0", true).then(o => o.address)
   */
  getPublicKey(
    path: string,
    boolDisplay?: boolean
  ): Promise<{
    publicKey: string;
    address: string;
  }> {
    const paths = splitPath(path);
    const buffer = Buffer.alloc(1 + paths.length * 4);
    buffer[0] = paths.length;
    paths.forEach((element, index) => {
      buffer.writeUInt32BE(element, 1 + 4 * index);
    });
    return this.transport
        .send(CLA, INS_GET_PK, boolDisplay ? 0x01 : 0x00, 0x00, buffer)
        .then((response) => {
          const status = Buffer.from(
              response.slice(response.length - 2)
          ).readUInt16BE(0);

          if (status === SW_OK) {
            const _response = Buffer.from(response.slice(0, response.length - 2));
            const publicKeyLength = _response[0];
            const addressLength = _response[1 + publicKeyLength];

            return {
              publicKey: _response.slice(1, 1 + publicKeyLength).toString("hex"),
              address: _response
                  .slice(
                      1 + publicKeyLength + 1,
                      1 + publicKeyLength + 1 + addressLength
                  )
                  .toString("utf8"),
            };
          } else {
            throw new Error(
                "Get PublicKey not allowed."
            );
          }
        });
  }

  /**
   * sign a Nuls transaction.
   *
   * @param path: the BIP32 path to sign the transaction on
   * @param rawTxHex the raw nuls transaction in hexadecimal to sign
   * @return an object with the signature
   * @example
   * nuls.signTransaction("44'/60'/0'/0/0", rawTxHex).then(o => o.signature)
   */
  signTransaction(
    path: string,
    rawTxHex: string
  ): Promise<{
    signature: string;
  }> {
    const transaction = Buffer.from(rawTxHex, 'hex');
    if (transaction.length > TX_MAX_SIZE) {
      throw new Error(
        "Transaction too large: max = " +
          TX_MAX_SIZE +
          "; actual = " +
          transaction.length
      );
    }

    const apdus: Buffer[] = [];
    let response;
    const paths = splitPath(path);
    const bufferSize = 1 + paths.length * 4;
    const buffer = Buffer.alloc(bufferSize);
    buffer[0] = paths.length;
    paths.forEach(function (element, index) {
      buffer.writeUInt32BE(element, 1 + 4 * index);
    });
    let chunkSize = APDU_MAX_SIZE - bufferSize;

    if (transaction.length <= chunkSize) {
      // it fits in a single apdu
      apdus.push(Buffer.concat([buffer, transaction]));
    } else {
      // we need to send multiple apdus to transmit the entire transaction
      let chunk = Buffer.alloc(chunkSize);
      let offset = 0;
      transaction.copy(chunk, 0, offset, chunkSize);
      apdus.push(Buffer.concat([buffer, chunk]));
      offset += chunkSize;

      while (offset < transaction.length) {
        const remaining = transaction.length - offset;
        chunkSize = remaining < APDU_MAX_SIZE ? remaining : APDU_MAX_SIZE;
        chunk = Buffer.alloc(chunkSize);
        transaction.copy(chunk, 0, offset, offset + chunkSize);
        offset += chunkSize;
        apdus.push(chunk);
      }
    }
    let statusWords = [SW_OK, SW_CANCEL, SW_UNKNOWN_OP, SW_MULTI_OP, SW_NOT_ALLOWED, SW_UNSUPPORTED, SW_KEEP_ALIVE];
    return foreach(apdus, (data, i) =>
      this.transport
        .send(
          CLA,
          INS_SIGN_TX,
          i,
          i === apdus.length - 1 ? P2_LAST_APDU : P2_MORE_APDU,
          data,
          statusWords
        )
        .then((apduResponse) => {
          const status = Buffer.from(
            apduResponse.slice(apduResponse.length - 2)
          ).readUInt16BE(0);

          if (status === SW_OK) {
            response = apduResponse;
          } else if (status === SW_BLIND_SIGN) {
            throw new Error("Please enable Blind signing in the NULS app Settings");
          } else {
            throw new Error("Transaction approval request was rejected");
          }
        })
        .catch((e) => {
          if (e && e.statusCode === SW_BLIND_SIGN) {
            throw new Error("Please enable Blind signing in the NULS app Settings");
          }
          throw e;
        })
    ).then(() => {
      const status = Buffer.from(
        response.slice(response.length - 2)
      ).readUInt16BE(0);

      if (status === SW_OK) {
        const signature = Buffer.from(response.slice(0, response.length - 2));
        return {
          signature: signature.toString("hex"),
        };
      } else if (status === SW_BLIND_SIGN) {
        throw new Error("Please enable Blind signing in the NULS app Settings");
      } else {
        throw new Error("Transaction approval request was rejected");
      }
    });
  }

  /**
   * sign a message.
   *
   * @param path: the BIP32 path to sign the transaction on
   * @param messageHex message
   * @return an object with the signature
   * @example
   * nuls.signPersonalMessage("44'/60'/0'/0/0", Buffer.from("test").toString("hex")).then(o => o.signature)
   */
  signPersonalMessage(
      path: string,
      messageHex: string
  ): Promise<{
    signature: string;
  }> {
    const message = Buffer.from(messageHex, "hex");
    const apdus: Buffer[] = [];
    let response;
    const paths = splitPath(path);
    const bufferSize = 1 + paths.length * 4 + 4;
    const buffer = Buffer.alloc(bufferSize);
    buffer[0] = paths.length;
    paths.forEach(function (element, index) {
      buffer.writeUInt32BE(element, 1 + 4 * index);
    });
    buffer.writeUInt32BE(message.length, 1 + 4 * paths.length);
    let chunkSize = APDU_MAX_SIZE - bufferSize;

    if (message.length <= chunkSize) {
      // it fits in a single apdu
      apdus.push(Buffer.concat([buffer, message]));
    } else {
      // we need to send multiple apdus to transmit the entire transaction
      let chunk = Buffer.alloc(chunkSize);
      let offset = 0;
      message.copy(chunk, 0, offset, chunkSize);
      apdus.push(Buffer.concat([buffer, chunk]));
      offset += chunkSize;

      while (offset < message.length) {
        const remaining = message.length - offset;
        chunkSize = remaining < APDU_MAX_SIZE ? remaining : APDU_MAX_SIZE;
        chunk = Buffer.alloc(chunkSize);
        message.copy(chunk, 0, offset, offset + chunkSize);
        offset += chunkSize;
        apdus.push(chunk);
      }
    }
    let statusWords = [SW_OK, SW_CANCEL, SW_UNKNOWN_OP, SW_MULTI_OP, SW_NOT_ALLOWED, SW_UNSUPPORTED, SW_KEEP_ALIVE];
    return foreach(apdus, (data, i) =>
        this.transport
            .send(
                CLA,
                INS_SIGN_MESSAGE,
                i,
                i === apdus.length - 1 ? P2_LAST_APDU : P2_MORE_APDU,
                data,
                statusWords
            )
            .then((apduResponse) => {
              const status = Buffer.from(
                  apduResponse.slice(apduResponse.length - 2)
              ).readUInt16BE(0);

              if (status === SW_OK) {
                response = apduResponse;
              } else {
                throw new Error("Transaction approval request was rejected");
              }
            })
    ).then(() => {
      const status = Buffer.from(
          response.slice(response.length - 2)
      ).readUInt16BE(0);

      if (status === SW_OK) {
        const signature = Buffer.from(response.slice(0, response.length - 2));
        return {
          signature: signature.toString("hex"),
        };
      } else {
        throw new Error("Transaction approval request was rejected");
      }
    });
  }

}
