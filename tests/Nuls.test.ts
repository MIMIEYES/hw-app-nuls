import {
    openTransportReplayer,
    RecordStore,
} from "@ledgerhq/hw-transport-mocker";
import Nuls from "../src/Nuls";

test("getAppConfiguration", async () => {
    const transport = await openTransportReplayer(
        RecordStore.fromString(`
    => e004000000
    <= 000300019000
    `)
    );
    const nuls = new Nuls(transport);
    const result = await nuls.getAppConfiguration();
    expect(result).toEqual({ version: "3.0.1" });
});

test("getPublicKey", async () => {
    const transport = await openTransportReplayer(
        RecordStore.fromString(`
    => e005010015058000002c8000003c800000000000000000000000
    <= 2102401b78e28d293ad840f9298c2c7e522c68776e3badf092c2dbf457af1b8ed43e4a4e554c536436486765517937796d75716e557876775962415a66346171736f6b5862556f359000
    `)
    );
    const nuls = new Nuls(transport);
    const result = await nuls.getPublicKey("44'/60'/0'/0/0", true);
    console.log(result, 'result');
    expect(result).toEqual({
        address: "NULSd6HgeQy7ymuqnUxvwYbAZf4aqsokXbUo5",
        publicKey:
            "02401b78e28d293ad840f9298c2c7e522c68776e3badf092c2dbf457af1b8ed43e",
    });
});

test("signTransaction", async () => {
    const transport = await openTransportReplayer(
        RecordStore.fromString(`
    => e006000096058000002c8000003c80000000000000000000000002008093006400008c0117010001b2a0187dfeb154a0852c822190317a96fdba4d7001000100e0ac003b00000000000000000000000000000000000000000000000000000000080000000000000000000117010001aca553215d606c663cac99e8503abe19f76289eb010001004026ff3a00000000000000000000000000000000
    <= 9000
    => e0060180140000000000000000000000000000000000000000
    <= 210358ddc5087021540174a6f3e5e986abcf49ada4023d5ce794798d380232915dda473045022100ec29ab820daad911311e87b0efb0604b8ea491410f2adc8de421dc75318e471302202e68e6994e80ae194c68e3451c043cfe102c231d19362af087acb9b2423bd3c29000
    `)
    );
    const nuls = new Nuls(transport);
    const {signature} = await nuls.signTransaction("44'/60'/0'/0/0", "02008093006400008c0117010001b2a0187dfeb154a0852c822190317a96fdba4d7001000100e0ac003b00000000000000000000000000000000000000000000000000000000080000000000000000000117010001aca553215d606c663cac99e8503abe19f76289eb010001004026ff3a000000000000000000000000000000000000000000000000000000000000000000000000");
    const result = signature;
    expect(result).toEqual(
        "210358ddc5087021540174a6f3e5e986abcf49ada4023d5ce794798d380232915dda473045022100ec29ab820daad911311e87b0efb0604b8ea491410f2adc8de421dc75318e471302202e68e6994e80ae194c68e3451c043cfe102c231d19362af087acb9b2423bd3c2"
    );
});

test("signMessage", async () => {
    const transport = await openTransportReplayer(
        RecordStore.fromString(`
    => e00700801d058000002c8000003c8000000000000000000000000000000474657374
    <= 7161f2522a27f450ef0254633db0c586f1e93ea632cadef5664d796ed1d83ba109761e8a6187c812f8c480b06638550d126d97b423c09a361462835f3869e2191c9000
    `)
    );
    const nuls = new Nuls(transport);
    const {signature} = await nuls.signPersonalMessage("44'/60'/0'/0/0", Buffer.from("test").toString("hex"));
    const result = signature;
    expect(result).toEqual(
        "7161f2522a27f450ef0254633db0c586f1e93ea632cadef5664d796ed1d83ba109761e8a6187c812f8c480b06638550d126d97b423c09a361462835f3869e2191c"
    );
});

