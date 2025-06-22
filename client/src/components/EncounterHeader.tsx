interface EncounterHeaderProps {
  encounterSentence?: string;
}

export default function EncounterHeader({ encounterSentence }: EncounterHeaderProps) {
  return (
    <div className="fixed top-16 w-full bg-purple-600 border-b border-purple-500 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-white mb-2">Current Encounter</h2>
          <div className="bg-purple-700 rounded-lg p-4">
            <p className="text-2xl font-bold text-white">
              {encounterSentence || "No encounter set"}
            </p>
            <p className="text-purple-200 text-sm mt-2">GM's Encounter Words</p>
          </div>
        </div>
      </div>
    </div>
  );
}
