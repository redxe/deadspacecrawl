function createPrimeLookup() {
  const sieveLimit = 1000000;
  const phiWidth = 32768;
  const phiDepth = 64;
  const segmentSize = 1048576;
  let primeCounts;
  let smallPrimes;
  let phiTable;
  const countCache = new Map();

  function initialize() {
    if (primeCounts) return;
    const composite = new Uint8Array(sieveLimit + 1);
    primeCounts = new Uint32Array(sieveLimit + 1);
    smallPrimes = [];
    for (let candidate = 2; candidate <= sieveLimit; candidate += 1) {
      if (!composite[candidate]) {
        smallPrimes.push(candidate);
        for (let multiple = candidate * candidate; multiple <= sieveLimit; multiple += candidate) {
          composite[multiple] = 1;
        }
      }
      primeCounts[candidate] = smallPrimes.length;
    }
    phiTable = new Uint32Array(phiWidth * phiDepth);
    for (let value = 0; value < phiWidth; value += 1) phiTable[value] = value;
    for (let depth = 1; depth < phiDepth; depth += 1) {
      const offset = depth * phiWidth;
      const previousOffset = offset - phiWidth;
      const divisor = smallPrimes[depth - 1];
      for (let value = 0; value < phiWidth; value += 1) {
        phiTable[offset + value] = phiTable[previousOffset + value] - phiTable[previousOffset + Math.floor(value / divisor)];
      }
    }
  }

  function phi(value, depth) {
    if (depth === 0) return value;
    if (value < phiWidth && depth < phiDepth) return phiTable[depth * phiWidth + value];
    const lastPrime = smallPrimes[depth - 1];
    if (value <= lastPrime) return value > 0 ? 1 : 0;
    if (value <= sieveLimit && lastPrime * lastPrime >= value) return primeCounts[value] - depth + 1;
    return phi(value, depth - 1) - phi(Math.floor(value / lastPrime), depth - 1);
  }

  function countPrimes(value) {
    if (value <= sieveLimit) return primeCounts[value];
    const cached = countCache.get(value);
    if (cached !== undefined) return cached;
    const fourthRootCount = countPrimes(Math.floor(Math.sqrt(Math.sqrt(value))));
    const squareRootCount = countPrimes(Math.floor(Math.sqrt(value)));
    const cubeRootCount = countPrimes(Math.floor(Math.cbrt(value)));
    let count = phi(value, fourthRootCount)
      + (squareRootCount + fourthRootCount - 2) * (squareRootCount - fourthRootCount + 1) / 2;
    for (let index = fourthRootCount; index < squareRootCount; index += 1) {
      const quotient = Math.floor(value / smallPrimes[index]);
      count -= countPrimes(quotient);
      if (index < cubeRootCount) {
        const limit = countPrimes(Math.floor(Math.sqrt(quotient)));
        for (let inner = index; inner < limit; inner += 1) {
          count -= countPrimes(Math.floor(quotient / smallPrimes[inner])) - inner;
        }
      }
    }
    countCache.set(value, count);
    return count;
  }

  function sieveSegment(low, high) {
    const composite = new Uint8Array(high - low + 1);
    for (const prime of smallPrimes) {
      if (prime * prime > high) break;
      const first = Math.max(prime * prime, Math.ceil(low / prime) * prime);
      for (let multiple = first; multiple <= high; multiple += prime) composite[multiple - low] = 1;
    }
    return composite;
  }

  function neighboringPrime(value, direction) {
    if (value === 2 && direction < 0) return null;
    if (value === 3 && direction < 0) return 2;
    for (let candidate = value + (value === 2 ? 1 : direction * 2); ; candidate += direction * 2) {
      let prime = true;
      for (const divisor of smallPrimes) {
        if (divisor * divisor > candidate) break;
        if (candidate % divisor === 0) {
          prime = false;
          break;
        }
      }
      if (prime) return candidate;
    }
  }

  function inspect(index) {
    if (!Number.isSafeInteger(index) || index < 1 || index > 10000000000) {
      throw new Error('A single prime index must be an integer from 1 to 10,000,000,000.');
    }
    initialize();
    let value = smallPrimes[index - 1];
    if (value === undefined) {
      const logarithm = Math.log(index);
      const logLog = Math.log(logarithm);
      const estimate = Math.floor(index * (logarithm + logLog - 1 + (logLog - 2) / logarithm
        - (logLog * logLog - 6 * logLog + 11) / (2 * logarithm * logarithm)));
      countCache.clear();
      let rank = countPrimes(estimate);
      const direction = rank >= index ? -1 : 1;
      let boundary = direction < 0 ? estimate : estimate + 1;
      while (value === undefined) {
        const low = direction < 0 ? Math.max(2, boundary - segmentSize + 1) : boundary;
        const high = direction < 0 ? boundary : boundary + segmentSize - 1;
        const composite = sieveSegment(low, high);
        for (let candidate = direction < 0 ? high : low; candidate >= low && candidate <= high; candidate += direction) {
          if (composite[candidate - low]) continue;
          if (direction > 0) rank += 1;
          if (rank === index) {
            value = candidate;
            break;
          }
          if (direction < 0) rank -= 1;
        }
        boundary = direction < 0 ? low - 1 : high + 1;
      }
      countCache.clear();
    }
    return Object.freeze({
      index,
      value,
      previous: neighboringPrime(value, -1),
      next: neighboringPrime(value, 1),
    });
  }

  return inspect;
}

globalThis.lookupPrime = createPrimeLookup();