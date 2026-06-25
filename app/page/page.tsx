import mongoose from "mongoose";

export function Hallo({ strin }: { strin: string }) {
  return (
    <div style={{ padding: '10px' }}><h1>{strin}</h1></div>
  );
}

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (mongoose.connection.readyState === 0) {
    const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/school';
    await mongoose.connect(uri);
  }

  const studentSchema = new mongoose.Schema({
    name: String,
    age: Number,
    gpa: Number
  });
  
  const Studs = mongoose.models.student || mongoose.model('student', studentSchema);

  const sajstuds = await Studs.find({ name: "Sajid E" });

  return (
    <div>
      {sajstuds.map((stud) => (
        <Hallo key={stud._id.toString()} strin={stud.gpa != null ? stud.gpa.toString() : "N/A"} />
      ))}
    </div>
  );
}

